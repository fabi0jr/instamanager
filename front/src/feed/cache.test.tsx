import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type { Me } from '../api/cliente';
import { fetchFalso } from '../testes/fetchFalso';
import { esquecerFeed, Feed } from './Feed';
import { Folha } from './Folha';
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

beforeEach(() => {
  esquecerFeed();
  window.scrollTo = vi.fn();
  vi.stubGlobal('IntersectionObserver', class { observe() {} disconnect() {} unobserve() {} });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

test('sair do feed antes de a lista chegar (1º login → /instalar) não deixa "Ainda não tem post" ao voltar', async () => {
  // 1º pedido nunca responde (a tela foi trocada no meio); o 2º traz o post
  const respostas = [new Promise<Response>(() => {}), Promise.resolve(new Response(JSON.stringify({ itens: [post('a')], proximo: null })))];
  const fetchMock = vi.fn(() => respostas.shift()!);
  vi.stubGlobal('fetch', fetchMock);
  const primeira = render(<Feed me={me} />);
  primeira.unmount();
  render(<Feed me={me} />);
  expect(screen.queryByText('Ainda não tem post por aqui')).toBeNull();
  expect(await screen.findAllByRole('article')).toHaveLength(1);
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

test('lista carregada continua sendo restaurada ao voltar (cache de verdade)', async () => {
  const chamadas = fetchFalso({ 'GET /posts': { itens: [post('a')], proximo: null } });
  const primeira = render(<Feed me={me} />);
  await screen.findAllByRole('article');
  primeira.unmount();
  render(<Feed me={me} />);
  expect(screen.getAllByRole('article')).toHaveLength(1);
  expect(chamadas).toHaveLength(1);
});

test('Esc fecha a folha mesmo com o foco fora dela', () => {
  const fechar = vi.fn();
  render(<><button>fora</button><Folha titulo="Comentários" aoFechar={fechar}><p>oi</p></Folha></>);
  screen.getByText('fora').focus();
  fireEvent.keyDown(document.body, { key: 'Escape' });
  expect(fechar).toHaveBeenCalledTimes(1);
});

test('Esc com folhas aninhadas fecha só a de cima', () => {
  const a = vi.fn(), b = vi.fn();
  render(<Folha titulo="A" aoFechar={a}><Folha titulo="B" aoFechar={b}><p>x</p></Folha></Folha>);
  fireEvent.keyDown(document.body, { key: 'Escape' });
  expect(b).toHaveBeenCalledTimes(1);
  expect(a).not.toHaveBeenCalled();
});
