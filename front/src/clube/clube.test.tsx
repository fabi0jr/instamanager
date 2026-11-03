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

test('com pedido pendente o botão vira "Pedido enviado" desabilitado', async () => {
  fetchFalso({
    'GET /clubes/palmeiras': { ...base, tecnico: null, historico: [] },
    'GET /posts?clube=palmeiras': { itens: [], proximo: null },
    'GET /trocas/minhas': [{ id: 't1', tipo: 'ASSUMIR', status: 'PENDENTE', clubeId: 'remo' }],
  });
  render(<PerfilClube id="palmeiras" me={me} />);
  const botao = (await screen.findByRole('button', { name: 'Pedido enviado' })) as HTMLButtonElement;
  expect(botao.disabled).toBe(true);
  expect(screen.queryByRole('link', { name: 'Pedir este clube' })).toBeNull();
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
