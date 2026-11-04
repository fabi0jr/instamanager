import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type { Me } from '../api/cliente';
import { fetchFalso } from '../testes/fetchFalso';
import { CardPost } from './CardPost';
import type { Post } from './tipos';

const me: Me = { id: 'u1', nome: 'Lincoln', email: 'l@x.com', avatarUrl: null, isAdmin: false, pushEnabled: false, clube: null };
const palmeiras = { id: 'palmeiras', nome: 'Palmeiras', escudoUrl: '/escudos/palmeiras.svg' };
const post: Post = {
  id: 'p1', clube: palmeiras, autor: { id: 'u2', nome: 'Abel' }, legenda: '', texto: 'Bora', criadoEm: new Date().toISOString(), imagens: [],
  curtidas: 3, curtiu: false, reacoes: [{ emoji: '🔥', total: 2 }, { emoji: '❤️', total: 1 }], minhaReacao: null, comentarios: 0, podeEditar: false,
};
const pessoa = (id: string, nome: string, clube: typeof palmeiras | null = palmeiras) => ({ id, nome, avatarUrl: null, clube });
const lista = [
  { emoji: '🔥', usuarios: [pessoa('u2', 'Abel'), pessoa('u3', 'Lucas')] },
  { emoji: '❤️', usuarios: [pessoa('u4', 'Rita', null)] },
];

beforeEach(() => vi.stubGlobal('IntersectionObserver', class { observe() {} disconnect() {} unobserve() {} }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const abrir = () => fireEvent.click(screen.getByRole('button', { name: '3 reações' }));

test("tocar em 'N reações' abre Quem reagiu com abas por emoji", async () => {
  fetchFalso({ 'GET /posts/p1/reacoes': lista });
  render(<CardPost post={post} me={me} />);
  abrir();
  const folha = await screen.findByRole('dialog', { name: 'Reações' });
  const abas = within(folha).getAllByRole('tab').map((t) => t.textContent);
  expect(abas).toEqual(['Todas 3', '🔥 2', '❤️ 1']);
  expect(within(folha).getAllByRole('link')).toHaveLength(2 + 0); // Rita não tem clube: sem link
  expect(within(folha).getByLabelText('Abel, Palmeiras, reagiu com fogo').getAttribute('href')).toBe('/c/palmeiras');
  fireEvent.click(within(folha).getByRole('tab', { name: '❤️ 1' }));
  expect(within(folha).queryByText('Abel')).toBeNull();
  expect(within(folha).getByLabelText('Rita, reagiu com coração')).toBeTruthy();
  // teclado ← → troca de aba
  fireEvent.keyDown(within(folha).getByRole('tablist'), { key: 'ArrowRight' });
  expect(within(folha).getByRole('tab', { name: 'Todas 3' }).getAttribute('aria-selected')).toBe('true');
});

test('erro mostra "Tentar de novo"; 404 fecha a folha com o aviso de post indisponível', async () => {
  let n = 0;
  fetchFalso({ 'GET /posts/p1/reacoes': () => (n++ === 0 ? { status: 500, corpo: {} } : lista) });
  render(<CardPost post={post} me={me} />);
  abrir();
  expect(await screen.findByText('Não deu para carregar a lista')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
  expect(await screen.findByLabelText('Abel, Palmeiras, reagiu com fogo')).toBeTruthy();
  cleanup();
  fetchFalso({ 'GET /posts/p1/reacoes': { status: 404, corpo: { codigo: 'NAO_ENCONTRADO' } } });
  render(<CardPost post={post} me={me} />);
  abrir();
  expect(await screen.findByText('Este post não está mais disponível')).toBeTruthy();
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
});

test('post da CBF mostra "Comunicado oficial" e nunca "por <admin>"', () => {
  fetchFalso({});
  render(<CardPost post={{ ...post, clube: { id: 'cbf', nome: 'CBF', escudoUrl: '/escudos/cbf.svg' }, autor: { id: 'a1', nome: 'FabioAdmin' } }} me={me} />);
  expect(screen.getByText(/Comunicado oficial/)).toBeTruthy();
  expect(screen.queryByText(/FabioAdmin/)).toBeNull();
});
