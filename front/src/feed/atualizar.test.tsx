import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type { Me } from '../api/cliente';
import { fetchFalso } from '../testes/fetchFalso';
import { montarRolagem } from '../testes/rolagem';
import { esquecerFeed, Feed } from './Feed';
import type { Post } from './tipos';

const me: Me = { id: 'u1', nome: 'Lincoln', email: 'l@x.com', avatarUrl: null, isAdmin: false, pushEnabled: false, clube: null };
const post = (id: string): Post => ({
  id,
  clube: { id: 'palmeiras', nome: 'Palmeiras', escudoUrl: '/escudos/palmeiras.svg' },
  autor: { id: 'u2', nome: 'Abel' },
  legenda: 'Legenda ' + id,
  criadoEm: new Date().toISOString(),
  imagens: [{ id: id + 'i', miniUrl: `/uploads/${id}-mini.jpg`, cheiaUrl: `/uploads/${id}-cheia.jpg`, largura: 1000, altura: 1000, prompt: null }],
  curtidas: 0, curtiu: false, comentarios: 0, podeEditar: false,
});

let agora = 1_000_000;
let rolagem: ReturnType<typeof montarRolagem>;
beforeEach(() => {
  esquecerFeed();
  agora = 1_000_000;
  vi.spyOn(Date, 'now').mockImplementation(() => agora);
  vi.stubGlobal('IntersectionObserver', class { observe() {} disconnect() {} unobserve() {} });
  rolagem = montarRolagem();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const voltarAoApp = () => act(() => { document.dispatchEvent(new Event('visibilitychange')); });
const rotas = (...respostas: Post[][]) => {
  let i = 0;
  return { 'GET /posts': () => ({ itens: respostas[Math.min(i++, respostas.length - 1)], proximo: null }) };
};

test('voltar ao app depois de 60 s com post novo mostra "Novos posts" e o toque atualiza a lista', async () => {
  const chamadas = fetchFalso(rotas([post('a')], [post('n'), post('a')]));
  render(<Feed me={me} />, { container: rolagem.el });
  await screen.findAllByRole('article');
  agora += 61_000;
  voltarAoApp();
  const botao = await screen.findByRole('button', { name: 'Novos posts' });
  expect(screen.getAllByRole('article')).toHaveLength(1); // não mexe na lista enquanto a pessoa lê
  fireEvent.click(botao);
  await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(2));
  expect(screen.queryByRole('button', { name: 'Novos posts' })).toBeNull();
  expect(chamadas).toHaveLength(3);
});

test('voltar antes de 60 s não pede nada; sem post novo não avisa', async () => {
  const chamadas = fetchFalso(rotas([post('a')]));
  render(<Feed me={me} />, { container: rolagem.el });
  await screen.findAllByRole('article');
  agora += 30_000;
  voltarAoApp();
  expect(chamadas).toHaveLength(1);
  agora += 40_000;
  voltarAoApp();
  await waitFor(() => expect(chamadas).toHaveLength(2));
  expect(screen.queryByRole('button', { name: 'Novos posts' })).toBeNull();
});

test('não pede em duplicado: dois retornos seguidos geram uma só busca', async () => {
  const chamadas = fetchFalso(rotas([post('a')]));
  render(<Feed me={me} />, { container: rolagem.el });
  await screen.findAllByRole('article');
  agora += 61_000;
  voltarAoApp();
  voltarAoApp();
  await waitFor(() => expect(chamadas).toHaveLength(2));
  voltarAoApp(); // acabou de buscar: o relógio reinicia
  expect(chamadas).toHaveLength(2);
});

const puxar = (de: number, ate: number) => {
  fireEvent.touchStart(document, { touches: [{ clientY: de }] });
  fireEvent.touchMove(document, { touches: [{ clientY: ate }] });
  fireEvent.touchEnd(document);
};

test('puxar para atualizar no topo recarrega o feed', async () => {
  const chamadas = fetchFalso(rotas([post('a')], [post('n'), post('a')]));
  render(<Feed me={me} />, { container: rolagem.el });
  await screen.findAllByRole('article');
  puxar(100, 260);
  await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(2));
  expect(chamadas).toHaveLength(2);
});

test('puxar pouco, ou puxar fora do topo, não recarrega', async () => {
  const chamadas = fetchFalso(rotas([post('a')]));
  render(<Feed me={me} />, { container: rolagem.el });
  await screen.findAllByRole('article');
  puxar(100, 130);
  rolagem.rolar(400, false);
  puxar(100, 300);
  expect(chamadas).toHaveLength(1);
});

test('falha ao atualizar mantém a lista na tela', async () => {
  let n = 0;
  fetchFalso({ 'GET /posts': () => (n++ ? { status: 500 } : { itens: [post('a')], proximo: null }) });
  render(<Feed me={me} />, { container: rolagem.el });
  await screen.findAllByRole('article');
  puxar(100, 260);
  await waitFor(() => expect(n).toBe(2));
  expect(screen.getAllByRole('article')).toHaveLength(1);
});

test('post que já estava na lista mostra os dados novos depois de atualizar', async () => {
  fetchFalso(rotas([post('a')], [{ ...post('a'), curtidas: 9, legenda: 'Legenda editada' }]));
  render(<Feed me={me} />, { container: rolagem.el });
  await screen.findByText('Legenda a');
  puxar(100, 260);
  expect(await screen.findByText('Legenda editada')).toBeTruthy();
  expect(screen.getByText(/9 curtidas/)).toBeTruthy();
});

test('gesto dentro da folha de comentários (.veu) não atualiza o feed', async () => {
  const chamadas = fetchFalso(rotas([post('a')]));
  const { container } = render(<Feed me={me} />, { container: rolagem.el });
  await screen.findAllByRole('article');
  const veu = document.createElement('div');
  veu.className = 'veu';
  container.append(veu);
  fireEvent.touchStart(veu, { touches: [{ clientY: 100 }] });
  fireEvent.touchMove(veu, { touches: [{ clientY: 300 }] });
  fireEvent.touchEnd(veu);
  expect(chamadas).toHaveLength(1);
});
