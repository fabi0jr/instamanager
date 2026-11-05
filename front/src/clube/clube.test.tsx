import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type { Me } from '../api/cliente';
import { fetchFalso } from '../testes/fetchFalso';
import { ListaClubes } from './ListaClubes';
import { PerfilClube } from './PerfilClube';

const me: Me = { id: 'u9', nome: 'Torcedor', email: 't@x.com', avatarUrl: null, isAdmin: false, pushEnabled: false, clube: null };
const base = { id: 'palmeiras', nome: 'Palmeiras', escudoUrl: '/escudos/palmeiras.svg' };
const post = (id: string, n = 1) => ({ id, imagens: Array.from({ length: n }, (_, i) => ({ id: id + i, miniUrl: `/${id}.jpg`, cheiaUrl: '', largura: 1, altura: 1, prompt: null })), autor: { id: 'u1', nome: 'Abel' }, clube: base });

beforeEach(() => {
  vi.stubGlobal('IntersectionObserver', class { observe() {} disconnect() {} });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

test('perfil mostra técnico atual e histórico com "até hoje" na tenure aberta', async () => {
  fetchFalso({
    'GET /clubes/palmeiras': {
      ...base,
      tecnico: { id: 'u1', nome: 'Abel' },
      historico: [
        { usuario: { id: 'u1', nome: 'Abel' }, inicio: '2026-11-03T12:00:00Z', fim: null },
        { usuario: { id: 'u2', nome: 'Lucas' }, inicio: '2026-10-12T12:00:00Z', fim: '2026-11-02T12:00:00Z' },
      ],
    },
    'GET /posts?clube=palmeiras': { itens: [post('a', 3)], proximo: null },
    'GET /trocas/minhas': [],
  });
  render(<PerfilClube id="palmeiras" me={me} />);
  expect(await screen.findByText('Abel')).toBeTruthy();
  expect(screen.getByText('desde 03/11/2026')).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Post de Abel, Palmeiras, 3 imagens' }).getAttribute('href')).toBe('/p/a');
  fireEvent.click(screen.getByRole('tab', { name: 'Histórico' }));
  expect(screen.getByText('03/11/2026 até hoje')).toBeTruthy();
  expect(screen.getByText('12/10/2026 a 02/11/2026')).toBeTruthy();
});

test('clube sem técnico mostra "Vaga aberta" e leva ao pedido em /trocar?clube=', async () => {
  fetchFalso({
    'GET /clubes/palmeiras': { ...base, tecnico: null, historico: [] },
    'GET /posts?clube=palmeiras': { itens: [], proximo: null },
    'GET /trocas/minhas': [],
  });
  render(<PerfilClube id="palmeiras" me={me} />);
  expect(await screen.findByText('Vaga aberta')).toBeTruthy();
  expect(screen.getByText('Ainda sem posts')).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Pedir este clube' }).getAttribute('href')).toBe('/trocar?clube=palmeiras');
});

const clubeLivre = () => ({
  'GET /clubes/palmeiras': { ...base, tecnico: null, historico: [] },
  'GET /posts?clube=palmeiras': { itens: [], proximo: null },
});

test('pedido pendente DESTE clube → "Pedido enviado" desabilitado', async () => {
  fetchFalso({ ...clubeLivre(), 'GET /trocas/minhas': [{ id: 't1', tipo: 'ASSUMIR', status: 'PENDENTE', clubeId: 'palmeiras' }] });
  render(<PerfilClube id="palmeiras" me={me} />);
  const botao = (await screen.findByRole('button', { name: 'Pedido enviado' })) as HTMLButtonElement;
  expect(botao.disabled).toBe(true);
  expect(screen.queryByRole('link', { name: 'Pedir este clube' })).toBeNull();
});

test('pedido pendente de OUTRO clube → "Você já tem um pedido pendente"', async () => {
  fetchFalso({ ...clubeLivre(), 'GET /trocas/minhas': [{ id: 't1', tipo: 'ASSUMIR', status: 'PENDENTE', clubeId: 'remo' }] });
  render(<PerfilClube id="palmeiras" me={me} />);
  const botao = (await screen.findByRole('button', { name: 'Você já tem um pedido pendente' })) as HTMLButtonElement;
  expect(botao.disabled).toBe(true);
  expect(screen.queryByRole('button', { name: 'Pedido enviado' })).toBeNull();
});

test('o próprio clube nunca mostra "Pedir este clube"', async () => {
  fetchFalso({
    'GET /clubes/palmeiras': { ...base, tecnico: null, historico: [] },
    'GET /posts?clube=palmeiras': { itens: [], proximo: null },
    'GET /trocas/minhas': [],
  });
  render(<PerfilClube id="palmeiras" me={{ ...me, clube: base }} />);
  await screen.findByText('Vaga aberta');
  expect(screen.queryByRole('button', { name: 'Pedir este clube' })).toBeNull();
});

test('lista de clubes: técnico ou "Vaga aberta", cada linha leva ao clube', async () => {
  fetchFalso({
    'GET /clubes': [
      { ...base, tecnico: { id: 'u1', nome: 'Lucas' } },
      { id: 'remo', nome: 'Remo', escudoUrl: '/escudos/remo.svg', tecnico: null },
    ],
  });
  render(<ListaClubes />);
  expect(await screen.findByText('Técnico: Lucas')).toBeTruthy();
  expect(screen.getByText('Vaga aberta')).toBeTruthy();
  expect(screen.getByRole('link', { name: /Remo/ }).getAttribute('href')).toBe('/c/remo');
});

test('grade do clube: post só de texto vira quadrado com as primeiras palavras, sem quebrar (sem imagens[0])', async () => {
  fetchFalso({
    'GET /clubes/palmeiras': { ...base, tecnico: { id: 'u1', nome: 'Abel' }, historico: [] },
    'GET /posts?clube=palmeiras': { itens: [{ ...post('t', 0), texto: 'Bora Palmeiras, hoje tem jogo', legenda: '' }, post('a')], proximo: null },
    'GET /trocas/minhas': [],
  });
  const { container } = render(<PerfilClube id="palmeiras" me={me} />);
  const link = await screen.findByRole('link', { name: 'Post de texto de Abel, Palmeiras' });
  expect(link.getAttribute('href')).toBe('/p/t');
  expect(link.textContent).toContain('Bora Palmeiras, hoje tem jogo');
  expect(container.querySelectorAll('.grade-capas img')).toHaveLength(1);
});

const dadosOndaB = { liga: { posicao: 10, ultimos: ['V', 'D'], pontos: 17, jogos: 12 } };

test('perfil do clube mostra posição e últimos 5', async () => {
  fetchFalso({
    'GET /clubes/palmeiras': { ...base, tecnico: { id: 'u1', nome: 'Abel' }, historico: [], ...dadosOndaB },
    'GET /posts?clube=palmeiras': { itens: [], proximo: null },
    'GET /trocas/minhas': [],
  });
  render(<PerfilClube id="palmeiras" me={me} />);
  const cartao = await screen.findByRole('link', { name: '10º na Liga, últimos 2: derrota, vitória' });
  expect(cartao.getAttribute('href')).toBe('/liga');
  expect(screen.getByText('· 17 pontos · 12 jogos')).toBeTruthy();
});

test('perfil do clube sem resultado esconde a posição', async () => {
  fetchFalso({
    'GET /clubes/palmeiras': { ...base, tecnico: null, historico: [], liga: { posicao: 3, ultimos: [] } },
    'GET /posts?clube=palmeiras': { itens: [], proximo: null },
    'GET /trocas/minhas': [],
  });
  render(<PerfilClube id="palmeiras" me={me} />);
  await screen.findByText('Vaga aberta');
  expect(screen.queryByText('na Liga')).toBeNull();
});

test('perfil da CBF sem técnico/histórico', async () => {
  fetchFalso({
    'GET /clubes/cbf': { id: 'cbf', nome: 'CBF', escudoUrl: '/escudos/cbf.svg', bio: null, tecnico: null, historico: [], liga: null },
    'GET /posts?clube=cbf': { itens: [], proximo: null },
    'GET /trocas/minhas': [],
  });
  render(<PerfilClube id="cbf" me={me} />);
  expect(await screen.findByText('Oficial')).toBeTruthy();
  expect(screen.getByText('Perfil oficial da liga')).toBeTruthy();
  expect(screen.queryByText('Vaga aberta')).toBeNull();
  expect(screen.queryByText('Técnico atual')).toBeNull();
  expect(screen.queryByRole('link', { name: 'Pedir este clube' })).toBeNull();
  expect(screen.queryByRole('tab', { name: 'Histórico' })).toBeNull();
  expect(screen.getByRole('heading', { name: 'Posts' })).toBeTruthy();
});

test('perfil do clube: técnico atual vê "Novo story"; torcedor não; admin vê o da CBF', async () => {
  const dados = (id: string, tecnico: unknown) => ({ ['GET /clubes/' + id]: { id, nome: id, escudoUrl: `/escudos/${id}.svg`, tecnico, historico: [], liga: null }, ['GET /posts?clube=' + id]: { itens: [], proximo: null }, 'GET /trocas/minhas': [] });
  fetchFalso(dados('palmeiras', { id: 'u9', nome: 'Torcedor' }));
  render(<PerfilClube id="palmeiras" me={me} />); // me.id u9 = técnico atual
  expect((await screen.findByRole('link', { name: 'Novo story' })).getAttribute('href')).toBe('/stories/novo');
  cleanup();
  fetchFalso(dados('flamengo', { id: 'outro', nome: 'Outro' }));
  render(<PerfilClube id="flamengo" me={me} />);
  await screen.findByText('Outro');
  expect(screen.queryByRole('link', { name: /Novo story/ })).toBeNull();
  cleanup();
  fetchFalso(dados('cbf', null));
  render(<PerfilClube id="cbf" me={{ ...me, isAdmin: true }} />);
  expect((await screen.findByRole('link', { name: 'Novo story da CBF' })).getAttribute('href')).toBe('/stories/novo?cbf=1');
});
