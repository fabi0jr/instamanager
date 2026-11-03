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

test('clube sem técnico mostra "Vaga aberta" e o botão de pedir', async () => {
  const chamadas = fetchFalso({
    'GET /clubes/palmeiras': { ...base, tecnico: null, historico: [] },
    'GET /posts?clube=palmeiras': { itens: [], proximo: null },
    'GET /trocas/minhas': [],
    'POST /trocas': { status: 201, corpo: { id: 't1', status: 'PENDENTE' } },
  });
  render(<PerfilClube id="palmeiras" me={me} />);
  expect(await screen.findByText('Vaga aberta')).toBeTruthy();
  expect(screen.getByText('Ainda sem posts')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Pedir este clube' }));
  await waitFor(() => expect((screen.getByRole('button', { name: 'Pedido enviado' }) as HTMLButtonElement).disabled).toBe(true));
  expect(JSON.parse(chamadas.find((c) => c.chave === 'POST /trocas')!.body as string)).toEqual({ tipo: 'ASSUMIR', clubeId: 'palmeiras' });
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
