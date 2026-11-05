import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type { Me } from '../api/cliente';
import { Atividade } from '../atividade/Atividade';
import { fetchFalso } from '../testes/fetchFalso';
import { Comentarios } from './Comentarios';
import { PostPagina } from './PostPagina';

const me: Me = { id: 'u1', nome: 'Lincoln', email: 'l@x.com', avatarUrl: null, isAdmin: false, pushEnabled: false, clube: null };
const usuario = (id: string, nome: string) => ({ id, nome, avatarUrl: null, clube: null });
const agora = Date.now();
const com = (id: string, nome: string, texto: string, extra: object = {}) => ({ id, texto, criadoEm: new Date(agora - 60_000 * (100 - Number(id.replace(/\D/g, '') || 0))).toISOString(), parentId: null, usuario: usuario('u-' + nome, nome), ...extra });
const abrir = () => render(<Comentarios postId="a" me={me} aoFechar={() => {}} aoContar={() => {}} />);
const campo = () => screen.getByRole('textbox') as HTMLTextAreaElement;

beforeEach(() => vi.stubGlobal('IntersectionObserver', class { observe() {} disconnect() {} unobserve() {} }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

test('respostas ficam agrupadas sob o raiz, numa lista aninhada, da mais velha à mais nova', async () => {
  fetchFalso({ 'GET /posts/a/comentarios': [com('c1', 'Marcos', 'Raiz'), com('c2', 'Rafa', 'Outro raiz'), com('c3', 'Ana', 'Primeira resp', { parentId: 'c1' }), com('c4', 'Bia', 'Segunda resp', { parentId: 'c1' })] });
  abrir();
  await screen.findByText('Raiz');
  const raizes = document.querySelectorAll('.threads > li');
  expect(raizes).toHaveLength(2);
  const respostas = [...raizes[0].querySelectorAll(':scope > ul.respostas > li')].map((l) => l.querySelector('p')!.textContent);
  expect(respostas).toEqual(['Primeira resp', 'Segunda resp']);
  expect(raizes[1].querySelector('ul.respostas')).toBeNull();
});

test('resposta cujo raiz não está na lista (oculto/apagado) não aparece', async () => {
  fetchFalso({ 'GET /posts/a/comentarios': [com('c1', 'Marcos', 'Raiz'), com('c3', 'Ana', 'Órfã', { parentId: 'sumiu' })] });
  abrir();
  await screen.findByText('Raiz');
  expect(screen.queryByText('Órfã')).toBeNull();
});

test('acima de 3 respostas só as 2 últimas aparecem; "Ver mais N respostas" abre o resto no lugar', async () => {
  const rs = [1, 2, 3, 4, 5].map((n) => com('c1' + n, 'Ana', `Resp ${n}`, { parentId: 'c1' }));
  fetchFalso({ 'GET /posts/a/comentarios': [com('c1', 'Marcos', 'Raiz'), ...rs] });
  abrir();
  await screen.findByText('Raiz');
  expect(screen.queryByText('Resp 1')).toBeNull();
  expect(screen.getByText('Resp 4')).toBeTruthy();
  expect(screen.getByText('Resp 5')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Ver mais 3 respostas' }));
  expect([...document.querySelectorAll('ul.respostas > li p')].map((p) => p.textContent)).toEqual(['Resp 1', 'Resp 2', 'Resp 3', 'Resp 4', 'Resp 5']);
  expect(screen.queryByRole('button', { name: /Ver mais/ })).toBeNull();
});

test('com 3 respostas aparecem todas, sem "Ver mais"', async () => {
  fetchFalso({ 'GET /posts/a/comentarios': [com('c1', 'Marcos', 'Raiz'), ...[1, 2, 3].map((n) => com('c1' + n, 'Ana', `Resp ${n}`, { parentId: 'c1' }))] });
  abrir();
  await screen.findByText('Resp 1');
  expect(screen.queryByRole('button', { name: /Ver mais/ })).toBeNull();
});

test('Responder mostra "Respondendo a Fulano", preenche @Fulano, dá foco ao campo e o ✕ cancela e devolve o foco', async () => {
  fetchFalso({ 'GET /posts/a/comentarios': [com('c1', 'Marcos', 'Raiz')] });
  abrir();
  const botao = await screen.findByRole('button', { name: 'Responder a Marcos' });
  fireEvent.click(botao);
  const faixa = screen.getByRole('status');
  expect(faixa.textContent).toContain('Respondendo a Marcos');
  expect(campo().value).toBe('@Marcos ');
  expect(campo().placeholder).toBe('Responda a Marcos');
  await waitFor(() => expect(document.activeElement).toBe(campo()));
  expect(campo().selectionStart).toBe('@Marcos '.length);
  fireEvent.click(within(faixa).getByRole('button', { name: 'Cancelar resposta' }));
  expect(screen.queryByText(/Respondendo a/)).toBeNull();
  expect(campo().value).toBe('');
  expect(campo().placeholder).toBe('Comente como Lincoln');
  await waitFor(() => expect(document.activeElement).toBe(botao));
});

test('responder uma resposta envia como parentId a resposta CLICADA (o back sobe para o raiz), com o texto começando por @[Fulano](id) ', async () => {
  const chamadas = fetchFalso({
    'GET /posts/a/comentarios': [com('c1', 'Marcos', 'Raiz'), com('c2', 'Rafa', 'Resp do Rafa', { parentId: 'c1' })],
    'POST /posts/a/comentarios': { status: 201, corpo: com('c9', 'Lincoln', 'x', { parentId: 'c1' }) },
  });
  abrir();
  fireEvent.click(await screen.findByRole('button', { name: 'Responder a Rafa' }));
  expect(screen.getByRole('status').textContent).toContain('Respondendo a Rafa');
  fireEvent.change(campo(), { target: { value: '@Rafa concordo' } });
  fireEvent.click(screen.getByRole('button', { name: 'Publicar' }));
  await waitFor(() => expect(chamadas.some((c) => c.chave === 'POST /posts/a/comentarios')).toBe(true));
  expect(JSON.parse(chamadas.find((c) => c.chave === 'POST /posts/a/comentarios')!.body as string)).toEqual({ texto: '@[Rafa](u-Rafa) concordo', parentId: 'c2' });
  await waitFor(() => expect(screen.queryByText(/Respondendo a/)).toBeNull());
  expect(document.querySelectorAll('.threads > li')).toHaveLength(1); // cai sob o mesmo raiz
  expect(document.querySelectorAll('.threads > li ul.respostas > li')).toHaveLength(2);
});

test('responder o raiz envia o id do raiz', async () => {
  const chamadas = fetchFalso({ 'GET /posts/a/comentarios': [com('c1', 'Marcos', 'Raiz')], 'POST /posts/a/comentarios': { status: 201, corpo: com('c9', 'Lincoln', 'x', { parentId: 'c1' }) } });
  abrir();
  fireEvent.click(await screen.findByRole('button', { name: 'Responder a Marcos' }));
  fireEvent.click(screen.getByRole('button', { name: 'Publicar' }));
  await waitFor(() => expect(chamadas.some((c) => c.chave === 'POST /posts/a/comentarios')).toBe(true));
  expect(JSON.parse(chamadas.find((c) => c.chave === 'POST /posts/a/comentarios')!.body as string).parentId).toBe('c1');
});

test('tocar Responder não apaga o rascunho: "@Nome " entra na frente; trocar de alvo troca só o prefixo', async () => {
  fetchFalso({ 'GET /posts/a/comentarios': [com('c1', 'Marcos', 'Raiz'), com('c2', 'Rafa', 'Resp', { parentId: 'c1' })] });
  abrir();
  const marcos = await screen.findByRole('button', { name: 'Responder a Marcos' });
  fireEvent.change(campo(), { target: { value: 'já tinha escrito isto' } });
  fireEvent.click(marcos);
  expect(campo().value).toBe('@Marcos já tinha escrito isto');
  fireEvent.click(screen.getByRole('button', { name: 'Responder a Rafa' }));
  expect(campo().value).toBe('@Rafa já tinha escrito isto');
  expect(screen.getByRole('status').textContent).toContain('Respondendo a Rafa');
  fireEvent.click(screen.getByRole('button', { name: 'Cancelar resposta' }));
  expect(campo().value).toBe('já tinha escrito isto');
  await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Responder a Rafa' })));
});

test('comentário comum não manda parentId', async () => {
  const chamadas = fetchFalso({ 'GET /posts/a/comentarios': [], 'POST /posts/a/comentarios': { status: 201, corpo: com('c9', 'Lincoln', 'oi') } });
  abrir();
  await screen.findByText('Ainda ninguém comentou');
  fireEvent.change(campo(), { target: { value: 'oi' } });
  fireEvent.click(screen.getByRole('button', { name: 'Publicar' }));
  await waitFor(() => expect(chamadas.some((c) => c.chave === 'POST /posts/a/comentarios')).toBe(true));
  expect(JSON.parse(chamadas.find((c) => c.chave === 'POST /posts/a/comentarios')!.body as string)).toEqual({ texto: 'oi' });
});

test('raiz sumiu (400 em parentId): a faixa vira "Esse comentário não existe mais." e o ✕ limpa; o texto não se perde', async () => {
  fetchFalso({
    'GET /posts/a/comentarios': [com('c1', 'Marcos', 'Raiz')],
    'POST /posts/a/comentarios': { status: 400, corpo: { codigo: 'DADOS_INVALIDOS', mensagem: 'x', campos: ['parentId'] } },
  });
  abrir();
  fireEvent.click(await screen.findByRole('button', { name: 'Responder a Marcos' }));
  fireEvent.change(campo(), { target: { value: '@Marcos oi' } });
  fireEvent.click(screen.getByRole('button', { name: 'Publicar' }));
  const alerta = await screen.findByRole('alert');
  expect(alerta.textContent).toContain('Esse comentário não existe mais.');
  expect(campo().value).toBe('@Marcos oi');
  expect(document.querySelectorAll('.comentario.resposta')).toHaveLength(0);
  fireEvent.click(within(alerta).getByRole('button', { name: 'Cancelar resposta' }));
  expect(screen.queryByRole('alert')).toBeNull();
  expect(campo().value).toBe('oi'); // o ✕ tirou só o '@Marcos ' do início; o texto fica
  expect(campo().placeholder).toBe('Comente como Lincoln');
});

test('✕ da resposta tira só o "@Nome " do início e a menção dele; o resto do texto fica e segue como comentário comum', async () => {
  const chamadas = fetchFalso({ 'GET /posts/a/comentarios': [com('c1', 'Marcos', 'Raiz')], 'POST /posts/a/comentarios': { status: 201, corpo: com('c9', 'Lincoln', 'x') } });
  abrir();
  fireEvent.click(await screen.findByRole('button', { name: 'Responder a Marcos' }));
  fireEvent.change(campo(), { target: { value: '@Marcos concordo totalmente' } });
  fireEvent.click(screen.getByRole('button', { name: 'Cancelar resposta' }));
  expect(screen.queryByText(/Respondendo a/)).toBeNull();
  expect(campo().value).toBe('concordo totalmente');
  fireEvent.click(screen.getByRole('button', { name: 'Publicar' }));
  await waitFor(() => expect(chamadas.some((c) => c.chave === 'POST /posts/a/comentarios')).toBe(true));
  expect(JSON.parse(chamadas.find((c) => c.chave === 'POST /posts/a/comentarios')!.body as string)).toEqual({ texto: 'concordo totalmente' }); // sem menção nem parentId
});

test('✕ com o texto já sem o "@Nome " (a pessoa apagou) não corta nada', async () => {
  fetchFalso({ 'GET /posts/a/comentarios': [com('c1', 'Marcos', 'Raiz')] });
  abrir();
  fireEvent.click(await screen.findByRole('button', { name: 'Responder a Marcos' }));
  fireEvent.change(campo(), { target: { value: 'Marcos disse tudo' } });
  fireEvent.click(screen.getByRole('button', { name: 'Cancelar resposta' }));
  expect(campo().value).toBe('Marcos disse tudo');
});

test('a folha continua um dialog no portal (<body>) com o campo dentro dela', async () => {
  fetchFalso({ 'GET /posts/a/comentarios': [] });
  const { container } = abrir();
  await screen.findByText('Ainda ninguém comentou');
  const folha = screen.getByRole('dialog', { name: 'Comentários' });
  expect(container.contains(folha)).toBe(false);
  expect(folha.parentElement!.parentElement).toBe(document.body);
  expect(folha.contains(campo())).toBe(true);
});

test('atividade RESPOSTA: avatar de quem respondeu, selo responder, texto e leva ao post com a folha aberta', async () => {
  const item = { id: 'r1', tipo: 'RESPOSTA', criadoEm: new Date().toISOString(), lida: false, ator: usuario('u9', 'Marcos'), post: { id: 'p1', miniUrl: '/m.jpg', resumo: 'x' }, comentario: { id: 'c1', resumo: 'Boa jogada' } };
  fetchFalso({ 'GET /atividade': { itens: [item], proximo: null }, 'POST /atividade/lidas': { status: 204 } });
  render(<Atividade meuId="u1" />);
  expect(await screen.findByText(/respondeu:/)).toBeTruthy();
  expect(document.querySelector('.texto-ativ')!.textContent).toBe('Marcos respondeu: “Boa jogada”');
  expect(document.querySelector('a.item-ativ')!.getAttribute('href')).toBe('/p/p1?comentarios=1');
  expect(document.querySelector('.selo-tipo svg')).not.toBeNull();
});

test('ícone responder segue a regra 24/24 e aria-hidden', () => {
  const raiz = readFileSync('src/icones/responder.svg', 'utf8').match(/<svg[^>]*>/)![0];
  expect(raiz).toMatch(/\swidth="24"/);
  expect(raiz).toMatch(/\sheight="24"/);
  expect(raiz).toMatch(/aria-hidden="true"/);
});

test('/p/:id?comentarios=1 abre a folha de comentários; sem o parâmetro, fechada', async () => {
  const post = { id: 'p1', clube: { id: 'palmeiras', nome: 'Palmeiras', escudoUrl: '/e.svg' }, autor: { id: 'u2', nome: 'Abel' }, legenda: 'x', texto: null, mencoes: [], imagens: [], criadoEm: new Date().toISOString(), curtidas: 0, curtiu: false, reacoes: [], minhaReacao: null, comentarios: 0, podeEditar: false, fixado: false, oculto: false, video: null };
  fetchFalso({ 'GET /posts/p1': post, 'GET /posts/p1/comentarios': [] });
  history.pushState(null, '', '/p/p1');
  render(<PostPagina id="p1" me={me} />);
  await screen.findAllByRole('button', { name: 'Comentar' });
  expect(screen.queryByRole('dialog', { name: 'Comentários' })).toBeNull();
  cleanup();
  history.pushState(null, '', '/p/p1?comentarios=1');
  render(<PostPagina id="p1" me={me} />);
  expect(await screen.findByRole('dialog', { name: 'Comentários' })).toBeTruthy();
  history.pushState(null, '', '/');
});

test('Responder de novo na MESMA pessoa (outro comentário dela) mantém a menção registrada: sai @[Marcos](id) e parentId do último clicado', async () => {
  const chamadas = fetchFalso({
    'GET /posts/a/comentarios': [com('c1', 'Marcos', 'Raiz'), com('c2', 'Marcos', 'Outra do Marcos', { parentId: 'c1' })],
    'POST /posts/a/comentarios': { status: 201, corpo: com('c9', 'Lincoln', 'x', { parentId: 'c1' }) },
  });
  abrir();
  const botoes = await screen.findAllByRole('button', { name: 'Responder a Marcos' });
  fireEvent.click(botoes[0]);
  fireEvent.click(botoes[1]);
  expect(campo().value).toBe('@Marcos ');
  fireEvent.change(campo(), { target: { value: '@Marcos oi' } });
  fireEvent.click(screen.getByRole('button', { name: 'Publicar' }));
  await waitFor(() => expect(chamadas.some((c) => c.chave === 'POST /posts/a/comentarios')).toBe(true));
  expect(JSON.parse(chamadas.find((c) => c.chave === 'POST /posts/a/comentarios')!.body as string)).toEqual({ texto: '@[Marcos](u-Marcos) oi', parentId: 'c2' });
});
