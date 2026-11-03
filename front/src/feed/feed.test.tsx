import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type { Me } from '../api/cliente';
import { fetchFalso } from '../testes/fetchFalso';
import { CardPost } from './CardPost';
import { Comentarios } from './Comentarios';
import { Feed } from './Feed';
import type { Post } from './tipos';

const me: Me = { id: 'u1', nome: 'Lincoln', email: 'l@x.com', avatarUrl: null, isAdmin: false, pushEnabled: false, clube: null };
const post = (id: string, extra: Partial<Post> = {}): Post => ({
  id,
  clube: { id: 'palmeiras', nome: 'Palmeiras', escudoUrl: '/escudos/palmeiras.svg' },
  autor: { id: 'u2', nome: 'Abel' },
  legenda: 'Treino de hoje',
  criadoEm: new Date().toISOString(),
  imagens: [{ id: id + 'i', miniUrl: `/uploads/${id}-mini.jpg`, cheiaUrl: `/uploads/${id}-cheia.jpg`, largura: 1000, altura: 1000, prompt: null }],
  curtidas: 3,
  curtiu: false,
  comentarios: 0,
  podeEditar: false,
  ...extra,
});

let observadores: { cb: IntersectionObserverCallback }[] = [];
beforeEach(() => {
  observadores = [];
  vi.stubGlobal('IntersectionObserver', class {
    constructor(public cb: IntersectionObserverCallback) { observadores.push(this); }
    observe() {} disconnect() {} unobserve() {}
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
const chegouNoFim = () => act(() => observadores.forEach((o) => o.cb([{ isIntersecting: true }] as IntersectionObserverEntry[], o as never)));

test('feed carrega a próxima página ao chegar no fim', async () => {
  const chamadas = fetchFalso({
    'GET /posts': { itens: [post('a'), post('b')], proximo: 'c1' },
    'GET /posts?antes=c1': { itens: [post('c')], proximo: null },
  });
  render(<Feed me={me} />);
  await screen.findAllByRole('article');
  expect(screen.getAllByRole('article')).toHaveLength(2);
  chegouNoFim();
  await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(3));
  expect(chamadas.map((c) => c.chave)).toEqual(['GET /posts', 'GET /posts?antes=c1']);
  expect(screen.getByText('Você viu tudo por aqui.')).toBeTruthy();
});

test('feed: erro mostra Tentar de novo; vazio mostra o texto', async () => {
  fetchFalso({ 'GET /posts': { status: 500 } });
  render(<Feed me={me} />);
  expect(await screen.findByText('Não deu para carregar o feed')).toBeTruthy();
  cleanup();
  fetchFalso({ 'GET /posts': { itens: [], proximo: null } });
  render(<Feed me={me} />);
  expect(await screen.findByText('Ainda não tem post por aqui')).toBeTruthy();
});

test('curtir atualiza o contador na hora e desfaz se a API falhar', async () => {
  let resolve!: (r: Response) => void;
  vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((r) => (resolve = r))));
  render(<CardPost post={post('a')} me={me} />);
  fireEvent.click(screen.getByRole('button', { name: 'Curtir' }));
  expect(screen.getByText('4 curtidas')).toBeTruthy(); // antes da resposta
  expect(screen.getByRole('button', { name: 'Descurtir' }).getAttribute('aria-pressed')).toBe('true');
  await act(async () => resolve(new Response(JSON.stringify({ codigo: 'X' }), { status: 500 })));
  expect(await screen.findByText('3 curtidas')).toBeTruthy();
  expect(screen.getByRole('alert').textContent).toContain('Não deu para curtir. Tente de novo.');
});

test('toque duplo na imagem curte, mas nunca descurte', async () => {
  const chamadas = fetchFalso({ 'PUT /posts/a/curtida': { status: 204 } });
  render(<CardPost post={post('a')} me={me} />);
  const img = screen.getByRole('img', { name: 'Imagem 1 de 1: Treino de hoje' });
  fireEvent.doubleClick(img);
  fireEvent.doubleClick(img);
  await waitFor(() => expect(screen.getByText('4 curtidas')).toBeTruthy());
  expect(chamadas).toHaveLength(1);
});

test('card usa miniUrl e lazy, nunca cheiaUrl', () => {
  const p = post('a', { imagens: [1, 2].map((n) => ({ id: 'i' + n, miniUrl: `/m${n}.jpg`, cheiaUrl: `/c${n}.jpg`, largura: 1000, altura: 1000, prompt: null })) });
  const { container } = render(<CardPost post={p} me={me} prioridade />);
  const imgs = [...container.querySelectorAll('.carrossel img')] as HTMLImageElement[];
  expect(imgs.map((i) => i.getAttribute('src'))).toEqual(['/m1.jpg', '/m2.jpg']);
  expect(imgs.map((i) => i.getAttribute('loading'))).toEqual(['eager', 'lazy']);
  expect(container.innerHTML).not.toContain('/c1.jpg');
});

test('escudo com erro cai no escudo genérico; proporção segue a 1ª imagem dentro de 4:5 e 1,91:1', () => {
  const p = post('a', { imagens: [{ id: 'i', miniUrl: '/m.jpg', cheiaUrl: '/c.jpg', largura: 3000, altura: 1000, prompt: null }] });
  const { container } = render(<CardPost post={p} me={me} />);
  const escudo = container.querySelector('.cabecalho img') as HTMLImageElement;
  fireEvent.error(escudo);
  expect(escudo.getAttribute('src')).toBe('/escudos/generico.svg');
  expect((container.querySelector('.carrossel') as HTMLElement).style.aspectRatio).toBe('1.91 / 1');
});

test('botões editar e apagar só aparecem com podeEditar', () => {
  render(<CardPost post={post('a')} me={me} />);
  expect(screen.queryByRole('button', { name: 'Mais opções' })).toBeNull();
  cleanup();
  render(<CardPost post={post('a', { podeEditar: true })} me={me} />);
  fireEvent.click(screen.getByRole('button', { name: 'Mais opções' }));
  expect(screen.getByRole('button', { name: 'Editar legenda e prompts' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Apagar post' })).toBeTruthy();
});

test('apagar pede confirmação, chama DELETE e avisa o pai', async () => {
  const chamadas = fetchFalso({ 'DELETE /posts/a': { status: 204 } });
  const aoApagar = vi.fn();
  render(<CardPost post={post('a', { podeEditar: true })} me={me} aoApagar={aoApagar} />);
  fireEvent.click(screen.getByRole('button', { name: 'Mais opções' }));
  fireEvent.click(screen.getByRole('button', { name: 'Apagar post' }));
  expect(screen.getByText('Apagar este post?')).toBeTruthy();
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Apagar post' }));
  await waitFor(() => expect(aoApagar).toHaveBeenCalledWith('a'));
  expect(chamadas[0].chave).toBe('DELETE /posts/a');
});

test('comentário mostra a tag do clube de quem comentou', async () => {
  fetchFalso({
    'GET /posts/a/comentarios': [
      { id: 'c1', texto: 'Boa!', criadoEm: new Date().toISOString(), usuario: { id: 'u2', nome: 'Abel', avatarUrl: null, clube: { id: 'palmeiras', nome: 'Palmeiras' } } },
      { id: 'c2', texto: 'Oi', criadoEm: new Date().toISOString(), usuario: { id: 'u3', nome: 'Torcedor', avatarUrl: null, clube: null } },
    ],
  });
  render(<Comentarios postId="a" me={me} aoFechar={() => {}} aoContar={() => {}} />);
  expect(await screen.findByLabelText('Clube Palmeiras')).toBeTruthy();
  expect(screen.getByText('PAL')).toBeTruthy();
  expect(screen.getAllByLabelText(/^Clube /)).toHaveLength(1);
});

test('comentário novo aparece na hora e a falha mostra "Não enviou"', async () => {
  fetchFalso({ 'GET /posts/a/comentarios': [], 'POST /posts/a/comentarios': { status: 500 } });
  render(<Comentarios postId="a" me={me} aoFechar={() => {}} aoContar={() => {}} />);
  await screen.findByText('Ainda ninguém comentou');
  fireEvent.change(screen.getByLabelText('Comente como Lincoln'), { target: { value: 'Show' } });
  fireEvent.click(screen.getByRole('button', { name: 'Publicar' }));
  expect(screen.getByText('Show')).toBeTruthy();
  expect(await screen.findByText('Não enviou. Toque para tentar de novo.')).toBeTruthy();
});
