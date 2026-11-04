import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type { Me } from '../api/cliente';
import { fetchFalso } from '../testes/fetchFalso';
import { CardPost } from './CardPost';
import { compartilhar } from './compartilhar';
import { esquecerFeed, Feed } from './Feed';
import type { Post } from './tipos';

const me: Me = { id: 'u1', nome: 'Lincoln', email: 'l@x.com', avatarUrl: null, isAdmin: false, pushEnabled: false, clube: null };
const admin: Me = { ...me, isAdmin: true };
const post = (id: string, extra: Partial<Post> = {}): Post => ({
  id,
  clube: { id: 'palmeiras', nome: 'Palmeiras', escudoUrl: '/escudos/palmeiras.svg' },
  autor: { id: 'u2', nome: 'Abel' },
  legenda: 'Treino de hoje',
  texto: null,
  fixado: false,
  oculto: false,
  criadoEm: new Date().toISOString(),
  imagens: [{ id: id + 'i', miniUrl: `/uploads/${id}-mini.jpg`, cheiaUrl: `/uploads/${id}-cheia.jpg`, largura: 1000, altura: 1000, prompt: null }],
  curtidas: 0,
  curtiu: false,
  reacoes: [],
  minhaReacao: null,
  comentarios: 0,
  podeEditar: false,
  ...extra,
});
const deTexto = (id: string, texto: string, extra: Partial<Post> = {}) => post(id, { imagens: [], legenda: '', texto, ...extra });

beforeEach(() => {
  esquecerFeed();
  vi.stubGlobal('IntersectionObserver', class { observe() {} disconnect() {} unobserve() {} });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const corpo = (c: { body?: BodyInit | null }) => JSON.parse(String(c.body));

test('toque duplo dá ❤️ (e não tira se já é ❤️)', async () => {
  const chamadas = fetchFalso({ 'PUT /posts/a/reacao': { status: 204 } });
  render(<CardPost post={post('a')} me={me} />);
  fireEvent.doubleClick(screen.getByRole('group', { name: 'Imagens do post' }));
  expect(await screen.findByRole('button', { name: 'Remover reação: Coração' })).toBeTruthy();
  expect(chamadas).toHaveLength(1);
  expect(corpo(chamadas[0])).toEqual({ emoji: '❤️' });
  fireEvent.doubleClick(screen.getByRole('group', { name: 'Imagens do post' }));
  expect(chamadas).toHaveLength(1);
});

test('toque duplo troca outra reação por ❤️', async () => {
  const chamadas = fetchFalso({ 'PUT /posts/a/reacao': { status: 204 } });
  render(<CardPost post={post('a', { curtidas: 1, curtiu: true, minhaReacao: '🔥', reacoes: [{ emoji: '🔥', total: 1 }] })} me={me} />);
  fireEvent.doubleClick(screen.getByRole('group', { name: 'Imagens do post' }));
  expect(await screen.findByRole('button', { name: 'Remover reação: Coração' })).toBeTruthy();
  expect(corpo(chamadas[0])).toEqual({ emoji: '❤️' });
});

test('toque curto reage ❤️ e de novo tira a reação', async () => {
  const chamadas = fetchFalso({ 'PUT /posts/a/reacao': { status: 204 }, 'DELETE /posts/a/reacao': { status: 204 } });
  render(<CardPost post={post('a')} me={me} />);
  fireEvent.click(screen.getByRole('button', { name: 'Reagir' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Remover reação: Coração' }));
  await waitFor(() => expect(chamadas.map((c) => c.chave)).toEqual(['PUT /posts/a/reacao', 'DELETE /posts/a/reacao']));
  expect(screen.getByRole('button', { name: 'Reagir' })).toBeTruthy();
});

test('segurar o botão abre o seletor com os 6 emojis; Esc fecha sem mudar', () => {
  vi.useFakeTimers();
  fetchFalso({});
  render(<CardPost post={post('a')} me={me} />);
  fireEvent.pointerDown(screen.getByRole('button', { name: 'Reagir' }), { pointerType: 'touch' });
  act(() => { vi.advanceTimersByTime(400); });
  const menu = screen.getByRole('menu');
  expect(within(menu).getAllByRole('menuitemradio').map((b) => b.getAttribute('aria-label'))).toEqual(['Coração', 'Fogo', 'Risada', 'Surpresa', 'Triste', 'Palmas']);
  fireEvent.keyDown(menu, { key: 'Escape' });
  expect(screen.queryByRole('menu')).toBeNull();
  expect(screen.getByRole('button', { name: 'Reagir' })).toBeTruthy();
});

test('trocar 🔥→😂 atualiza na hora e desfaz se a API falhar', async () => {
  fetchFalso({ 'PUT /posts/a/reacao': { status: 500 } });
  render(<CardPost post={post('a', { curtidas: 5, curtiu: true, minhaReacao: '🔥', reacoes: [{ emoji: '🔥', total: 5 }] })} me={me} />);
  fireEvent.keyDown(screen.getByRole('button', { name: 'Remover reação: Fogo' }), { key: 'ArrowUp' });
  fireEvent.click(screen.getByRole('menuitemradio', { name: 'Risada' }));
  expect(screen.getByRole('button', { name: 'Remover reação: Risada' })).toBeTruthy(); // otimista
  expect((await screen.findByRole('alert')).textContent).toBe('Não deu para reagir. Tente de novo.');
  expect(screen.getByRole('button', { name: 'Remover reação: Fogo' })).toBeTruthy();
  expect(screen.getByText('5 reações')).toBeTruthy();
});

test('linha de reações: até 3 emojis, total e rótulo completo; zero some; singular', () => {
  fetchFalso({});
  const { rerender } = render(<CardPost post={post('a', { curtidas: 14, curtiu: true, minhaReacao: '❤️', reacoes: [{ emoji: '❤️', total: 6 }, { emoji: '🔥', total: 5 }, { emoji: '😂', total: 3 }] })} me={me} />);
  const linha = screen.getByLabelText('14 reações: 6 Coração, 5 Fogo, 3 Risada');
  expect(linha.textContent).toContain('❤️🔥😂');
  expect(linha.textContent).toContain('14 reações');
  rerender(<CardPost post={post('a', { curtidas: 1, reacoes: [{ emoji: '👏', total: 1 }] })} me={me} />);
  expect(screen.getByText('1 reação')).toBeTruthy();
  rerender(<CardPost post={post('a')} me={me} />);
  expect(screen.queryByText(/reaç/)).toBeNull();
});

test('post de texto: bloco de texto sem imagem, com tamanho por comprimento; toque duplo dá ❤️', async () => {
  const chamadas = fetchFalso({ 'PUT /posts/t/reacao': { status: 204 } });
  const { container } = render(<CardPost post={deTexto('t', 'Bora Palmeiras')} me={me} />);
  expect(container.querySelector('.carrossel')).toBeNull();
  expect(container.querySelector('img[src^="/uploads"]')).toBeNull();
  const bloco = screen.getByText('Bora Palmeiras');
  expect(bloco.className).toContain('texto-g');
  fireEvent.doubleClick(bloco);
  await waitFor(() => expect(chamadas).toHaveLength(1));
  cleanup();
  render(<CardPost post={deTexto('t2', 'x'.repeat(150))} me={me} />);
  expect(screen.getByText('x'.repeat(150)).className).toContain('texto-m');
  cleanup();
  render(<CardPost post={deTexto('t3', 'y'.repeat(300))} me={me} />);
  expect(screen.getByText('y'.repeat(300)).className).toContain('texto-p');
});

test('texto longo corta com "mais" que expande no lugar', () => {
  fetchFalso({});
  render(<CardPost post={deTexto('t', 'z'.repeat(400))} me={me} />);
  fireEvent.click(screen.getByRole('button', { name: 'mais' }));
  expect(screen.queryByRole('button', { name: 'mais' })).toBeNull();
});

test('fixados vêm no topo com selo e sem repetir; só o 1º pedido traz fixados', async () => {
  fetchFalso({ 'GET /posts': { itens: [post('b'), post('c')], proximo: null, fixados: [post('a', { fixado: true })] } });
  render(<Feed me={me} />);
  const cards = await screen.findAllByRole('article');
  expect(cards).toHaveLength(3);
  expect(within(cards[0]).getByText('Fixado')).toBeTruthy();
  expect(within(cards[1]).queryByText('Fixado')).toBeNull();
});

test('admin vê Fixar no ⋯, e Desafixar quando já fixado; o 4º dá aviso de limite', async () => {
  const chamadas = fetchFalso({
    'PUT /admin/posts/a/fixar': { status: 409, corpo: { codigo: 'LIMITE_FIXADOS', mensagem: 'x' } },
    'DELETE /admin/posts/b/fixar': { status: 204 },
  });
  const { rerender } = render(<CardPost post={post('a', { podeEditar: true })} me={admin} />);
  fireEvent.click(screen.getByRole('button', { name: 'Mais opções' }));
  fireEvent.click(screen.getByRole('button', { name: 'Fixar no topo' }));
  expect(await screen.findByText('Já há 3 posts fixados. Desafixe um para fixar este.')).toBeTruthy();
  expect(chamadas[0].chave).toBe('PUT /admin/posts/a/fixar');
  cleanup();
  render(<CardPost post={post('b', { podeEditar: true, fixado: true })} me={admin} />);
  fireEvent.click(screen.getByRole('button', { name: 'Mais opções' }));
  fireEvent.click(screen.getByRole('button', { name: 'Desafixar' }));
  await waitFor(() => expect(chamadas.map((c) => c.chave)).toContain('DELETE /admin/posts/b/fixar'));
  void rerender;
});

test('quem não é admin não vê Fixar no ⋯ (técnico)', () => {
  fetchFalso({});
  render(<CardPost post={post('a', { podeEditar: true })} me={me} />);
  fireEvent.click(screen.getByRole('button', { name: 'Mais opções' }));
  expect(screen.queryByRole('button', { name: 'Fixar no topo' })).toBeNull();
  expect(screen.getByRole('button', { name: 'Editar legenda e prompts' })).toBeTruthy();
});

test('post de texto oferece Editar texto (e Apagar)', () => {
  fetchFalso({});
  render(<CardPost post={deTexto('t', 'oi', { podeEditar: true })} me={me} />);
  fireEvent.click(screen.getByRole('button', { name: 'Mais opções' }));
  expect(screen.getByRole('button', { name: 'Editar texto' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Editar legenda e prompts' })).toBeNull();
  expect(screen.getByRole('button', { name: 'Apagar post' })).toBeTruthy();
});

test('compartilhar usa navigator.share e cai no clipboard sem ele', async () => {
  const share = vi.fn(async () => {});
  vi.stubGlobal('navigator', { share });
  expect(await compartilhar({ id: 'a' })).toBe('compartilhado');
  expect(share).toHaveBeenCalledWith({ title: 'InstaManager', url: `${location.origin}/p/a` });
  const writeText = vi.fn(async () => {});
  vi.stubGlobal('navigator', { clipboard: { writeText } });
  expect(await compartilhar({ id: 'a' })).toBe('copiado');
  expect(writeText).toHaveBeenCalledWith(`${location.origin}/p/a`);
  vi.stubGlobal('navigator', { share: vi.fn(async () => { throw new DOMException('x', 'AbortError'); }) });
  expect(await compartilhar({ id: 'a' })).toBe('compartilhado'); // cancelar a folha não vira erro nem copia
  vi.stubGlobal('navigator', { share: vi.fn(async () => { throw new Error('x'); }), clipboard: { writeText: vi.fn(async () => { throw new Error('y'); }) } });
  expect(await compartilhar({ id: 'a' })).toBe('falhou');
});

test('botão Compartilhar no card mostra "Link copiado" ou o erro', async () => {
  vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn(async () => {}) } });
  fetchFalso({});
  render(<CardPost post={post('a')} me={me} />);
  fireEvent.click(screen.getByRole('button', { name: 'Compartilhar' }));
  expect((await screen.findByRole('status')).textContent).toContain('Link copiado');
  vi.stubGlobal('navigator', {});
  fireEvent.click(screen.getByRole('button', { name: 'Compartilhar' }));
  expect((await screen.findByRole('alert')).textContent).toContain('Não deu para compartilhar');
});

test('index.html tem og:title InstaManager e nenhuma og de conteúdo de post', () => {
  const html = readFileSync('index.html', 'utf8');
  expect(html).toMatch(/property="og:title"\s+content="InstaManager"/);
  expect(html).toMatch(/property="og:image"\s+content="[^"]*icon-512\.png"/);
  expect(html).not.toMatch(/og:description/);
});
