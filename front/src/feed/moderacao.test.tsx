import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type { Me } from '../api/cliente';
import { fetchFalso } from '../testes/fetchFalso';
import { cacheFeed, esquecerFeed } from './cacheFeed';
import { CardPost } from './CardPost';
import { Feed } from './Feed';
import { Comentarios } from './Comentarios';
import type { Post } from './tipos';

const me: Me = { id: 'u1', nome: 'Lincoln', email: 'l@x.com', avatarUrl: null, isAdmin: false, pushEnabled: false, clube: null };
const admin: Me = { ...me, isAdmin: true };
const post = (extra: Partial<Post> = {}): Post => ({
  id: 'a', clube: { id: 'palmeiras', nome: 'Palmeiras', escudoUrl: '/escudos/palmeiras.svg' }, autor: { id: 'u2', nome: 'Abel' }, legenda: 'Treino', texto: null, fixado: false, oculto: false,
  criadoEm: new Date().toISOString(), imagens: [{ id: 'ai', miniUrl: '/m.jpg', cheiaUrl: '/c.jpg', largura: 10, altura: 10, prompt: null }],
  curtidas: 0, curtiu: false, reacoes: [], minhaReacao: null, comentarios: 0, podeEditar: false, ...extra,
});
const body = (c: { body?: BodyInit | null }) => JSON.parse(String(c.body));
const abrirMenu = () => fireEvent.click(screen.getByRole('button', { name: 'Mais opções' }));

beforeEach(() => vi.stubGlobal('IntersectionObserver', class { observe() {} disconnect() {} unobserve() {} }));
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

test('⋯ em todo post: alheio mostra só Ocultar para mim e Denunciar; técnico/admin os de edição', () => {
  fetchFalso({});
  render(<CardPost post={post()} me={me} />);
  abrirMenu();
  expect(screen.getByRole('button', { name: 'Ocultar para mim' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Denunciar post' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Apagar post' })).toBeNull();
  cleanup();
  render(<CardPost post={post({ podeEditar: true })} me={me} />);
  abrirMenu();
  expect(screen.queryByRole('button', { name: 'Denunciar post' })).toBeNull();
  expect(screen.getByRole('button', { name: 'Apagar post' })).toBeTruthy();
});

test('denunciar: folha com motivo opcional (contador 300) e confirmação', async () => {
  const chamadas = fetchFalso({ 'POST /denuncias': { id: 'd1' } });
  render(<CardPost post={post()} me={me} />);
  abrirMenu();
  fireEvent.click(screen.getByRole('button', { name: 'Denunciar post' }));
  expect(screen.getByText('O admin recebe a denúncia. Ninguém mais vê quem denunciou.')).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Motivo (opcional)'), { target: { value: 'ofensivo' } });
  expect(screen.getByText('8/300')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Enviar denúncia' }));
  expect((await screen.findByRole('status')).textContent).toBe('Denúncia enviada. O admin vai olhar.');
  expect(body(chamadas[0])).toEqual({ postId: 'a', motivo: 'ofensivo' });
});

test('denunciar sem motivo não manda o campo; falha mostra erro e deixa tentar de novo', async () => {
  const chamadas = fetchFalso({ 'POST /denuncias': { status: 500 } });
  render(<CardPost post={post()} me={me} />);
  abrirMenu();
  fireEvent.click(screen.getByRole('button', { name: 'Denunciar post' }));
  fireEvent.click(screen.getByRole('button', { name: 'Enviar denúncia' }));
  expect((await screen.findByRole('alert')).textContent).toContain('Não deu para enviar a denúncia');
  expect(body(chamadas[0])).toEqual({ postId: 'a' });
  expect((screen.getByRole('button', { name: 'Enviar denúncia' }) as HTMLButtonElement).disabled).toBe(false);
});

test('ocultar para mim: vira linha com Desfazer e depois de 6 s sai da lista', async () => {
  vi.useFakeTimers();
  const chamadas = fetchFalso({ 'PUT /posts/a/ocultar-para-mim': { status: 204 } });
  const aoApagar = vi.fn();
  const aoOcultarParaMim = vi.fn();
  render(<CardPost post={post()} me={me} aoApagar={aoApagar} aoOcultarParaMim={aoOcultarParaMim} />);
  abrirMenu();
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Ocultar para mim' })); });
  expect(screen.getByText('Post oculto para você.')).toBeTruthy();
  expect(screen.queryByRole('article')).toBeNull();
  expect(chamadas[0].chave).toBe('PUT /posts/a/ocultar-para-mim');
  act(() => { vi.advanceTimersByTime(6100); });
  expect(aoOcultarParaMim).toHaveBeenCalledWith('a'); // callback próprio, não o de apagar (que avisa 'Post apagado')
  expect(aoApagar).not.toHaveBeenCalled();
});

test('ocultar para mim: Desfazer devolve o card e chama DELETE', async () => {
  const chamadas = fetchFalso({ 'PUT /posts/a/ocultar-para-mim': { status: 204 }, 'DELETE /posts/a/ocultar-para-mim': { status: 204 } });
  const aoApagar = vi.fn();
  render(<CardPost post={post()} me={me} aoApagar={aoApagar} />);
  abrirMenu();
  fireEvent.click(screen.getByRole('button', { name: 'Ocultar para mim' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Desfazer' }));
  expect(await screen.findByRole('article')).toBeTruthy();
  await waitFor(() => expect(chamadas.map((c) => c.chave)).toContain('DELETE /posts/a/ocultar-para-mim'));
  expect(aoApagar).not.toHaveBeenCalled();
});

test('admin: Ocultar do feed (PUT) mostra o selo Oculto e vira Mostrar de novo (DELETE)', async () => {
  const chamadas = fetchFalso({ 'PUT /admin/posts/a/ocultar': { status: 204 }, 'DELETE /admin/posts/a/ocultar': { status: 204 } });
  render(<CardPost post={post({ podeEditar: true, fixado: true })} me={admin} />);
  abrirMenu();
  fireEvent.click(screen.getByRole('button', { name: 'Ocultar do feed' }));
  expect(await screen.findByText('Oculto para todos. Só você, admin, vê.')).toBeTruthy();
  expect(screen.queryByText('Fixado')).toBeNull(); // ocultar também desafixa
  abrirMenu();
  fireEvent.click(screen.getByRole('button', { name: 'Mostrar de novo' }));
  await waitFor(() => expect(screen.queryByText('Oculto para todos. Só você, admin, vê.')).toBeNull());
  expect(chamadas.map((c) => c.chave)).toEqual(['PUT /admin/posts/a/ocultar', 'DELETE /admin/posts/a/ocultar']);
});

test('admin vê post oculto com faixa e Mostrar de novo no menu', () => {
  fetchFalso({});
  render(<CardPost post={post({ podeEditar: true, oculto: true })} me={admin} />);
  expect(screen.getByText('Oculto para todos. Só você, admin, vê.')).toBeTruthy();
  abrirMenu();
  expect(screen.getByRole('button', { name: 'Mostrar de novo' })).toBeTruthy();
});

const com = (id: string, uid: string, extra = {}) => ({ id, texto: 'Oi #bora', criadoEm: new Date().toISOString(), usuario: { id: uid, nome: 'X', avatarUrl: null, clube: null }, ...extra });
const montarComentarios = (m: Me, lista: unknown[]) => {
  const chamadas = fetchFalso({ 'GET /posts/a/comentarios': lista, 'POST /denuncias': { id: 'd' }, 'PUT /admin/comentarios/c1/ocultar': { status: 204 }, 'DELETE /admin/comentarios/c1/ocultar': { status: 204 }, 'DELETE /comentarios/c1': { status: 204 } });
  render(<Comentarios postId="a" me={m} aoFechar={() => {}} aoContar={() => {}} />);
  return chamadas;
};

test('comentário: próprio → Apagar; alheio → Denunciar comentário (envia commentId)', async () => {
  const chamadas = montarComentarios(me, [com('c1', 'u1'), com('c2', 'u3')]);
  const botoes = await screen.findAllByRole('button', { name: 'Opções do comentário' });
  expect(botoes).toHaveLength(2);
  fireEvent.click(botoes[0]);
  expect(screen.getByRole('button', { name: 'Apagar comentário' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Denunciar comentário' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
  fireEvent.click(botoes[1]);
  expect(screen.queryByRole('button', { name: 'Apagar comentário' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Denunciar comentário' }));
  fireEvent.click(screen.getByRole('button', { name: 'Enviar denúncia' }));
  await waitFor(() => expect(chamadas.some((c) => c.chave === 'POST /denuncias')).toBe(true));
  expect(body(chamadas.find((c) => c.chave === 'POST /denuncias')!)).toEqual({ commentId: 'c2' });
  expect((await screen.findByText('Denúncia enviada. O admin vai olhar.'))).toBeTruthy();
});

test('comentário: admin oculta/mostra e apaga; comentário oculto aparece com selo', async () => {
  const chamadas = montarComentarios(admin, [com('c1', 'u3')]);
  fireEvent.click(await screen.findByRole('button', { name: 'Opções do comentário' }));
  expect(screen.getByRole('button', { name: 'Apagar comentário' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Ocultar comentário' }));
  expect(await screen.findByText('Oculto')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Opções do comentário' }));
  fireEvent.click(screen.getByRole('button', { name: 'Mostrar de novo' }));
  await waitFor(() => expect(screen.queryByText('Oculto')).toBeNull());
  expect(chamadas.map((c) => c.chave)).toEqual(expect.arrayContaining(['PUT /admin/comentarios/c1/ocultar', 'DELETE /admin/comentarios/c1/ocultar']));
  void within;
});

test('hashtag no comentário vira link', async () => {
  montarComentarios(me, [com('c1', 'u3')]);
  expect((await screen.findByRole('link', { name: '#bora' })).getAttribute('href')).toBe('/tag/bora');
});

test('ocultar para mim grava a remoção no cache do Feed já no clique; Desfazer reinsere na mesma posição', async () => {
  esquecerFeed();
  const [a, b, c] = [post({ id: 'a' }), post({ id: 'b' }), post({ id: 'c' })];
  cacheFeed.atual = { meId: 'u1', itens: [a, b, c], proximo: null, y: 0, quando: Date.now() };
  fetchFalso({ 'PUT /posts/b/ocultar-para-mim': { status: 204 }, 'DELETE /posts/b/ocultar-para-mim': { status: 204 } });
  render(<CardPost post={b} me={me} />);
  abrirMenu();
  fireEvent.click(screen.getByRole('button', { name: 'Ocultar para mim' }));
  await screen.findByText('Post oculto para você.');
  expect(cacheFeed.atual!.itens.map((p) => p.id)).toEqual(['a', 'c']); // antes de qualquer timer
  fireEvent.click(screen.getByRole('button', { name: 'Desfazer' }));
  await screen.findByRole('article');
  expect(cacheFeed.atual!.itens.map((p) => p.id)).toEqual(['a', 'b', 'c']);
  esquecerFeed();
});

// timers falsos SEM avanço automático: deterministas (o relógio só anda quando o teste manda); as promessas são drenadas à mão
const drenar = () => act(async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); });
async function feedComDoisPosts() {
  esquecerFeed();
  vi.useFakeTimers();
  fetchFalso({ 'GET /posts': { itens: [post({ id: 'a' }), post({ id: 'b' })], proximo: null }, 'PUT /posts/b/ocultar-para-mim': { status: 204 } });
  const tela = render(<Feed me={me} />);
  await drenar();
  expect(screen.getAllByRole('article')).toHaveLength(2);
  fireEvent.click(screen.getAllByRole('button', { name: 'Mais opções' })[1]);
  fireEvent.click(screen.getByRole('button', { name: 'Ocultar para mim' }));
  await drenar();
  expect(screen.getByText('Post oculto para você.')).toBeTruthy();
  return tela;
}

test('no Feed: sair da tela durante o Desfazer não traz o post de volta', async () => {
  const primeira = await feedComDoisPosts();
  primeira.unmount();
  render(<Feed me={me} />);
  expect(screen.getAllByRole('article')).toHaveLength(1);
  esquecerFeed();
});

test('no Feed: passados os 6 s o card sai da lista sem o aviso de apagado', async () => {
  await feedComDoisPosts();
  await act(async () => { vi.advanceTimersByTime(6100); });
  expect(screen.queryByText('Post oculto para você.')).toBeNull();
  expect(screen.getAllByRole('article')).toHaveLength(1);
  expect(screen.queryByText('Post apagado')).toBeNull();
  esquecerFeed();
});
