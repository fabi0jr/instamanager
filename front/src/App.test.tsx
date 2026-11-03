import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { App } from './App';

const me = { id: '1', nome: 'Lincoln', email: 'l@x.com', avatarUrl: null, isAdmin: false, pushEnabled: false, clube: null };
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

test('sem sessão, qualquer rota privada mostra Entrar', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ codigo: 'NAO_AUTENTICADO', mensagem: '' }), { status: 401 })));
  history.pushState(null, '', '/p/abc');
  render(<App />);
  expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeTruthy();
  expect(screen.queryByRole('navigation')).toBeNull();
});

test('com sessão a barra tem 5 destinos; torcedor: Clube abre /clubes', async () => {
  vi.stubGlobal('fetch', vi.fn(async (u: string) => new Response(JSON.stringify(u === '/api/me' ? me : { itens: [], proximo: null }))));
  history.pushState(null, '', '/');
  render(<App />);
  const nav = await screen.findByRole('navigation');
  expect(nav.querySelectorAll('a')).toHaveLength(5);
  expect([...nav.querySelectorAll('.rotulo')].map((e) => e.textContent)).toEqual(['Feed', 'Galeria', 'Postar', 'Clube', 'Perfil']);
  expect(nav.querySelector('[href="/clubes"]')).toBeTruthy();
  expect(nav.querySelector('[href="/notificacoes"]')).toBeNull();
  expect(nav.querySelector('[aria-current="page"]')?.getAttribute('href')).toBe('/');
});

test('técnico vê Clube apontando para o próprio clube', async () => {
  const c = { id: 'palmeiras', nome: 'Palmeiras', escudoUrl: '/escudos/palmeiras.svg' };
  vi.stubGlobal('fetch', vi.fn(async (u: string) => new Response(JSON.stringify(u === '/api/me' ? { ...me, clube: c } : { itens: [], proximo: null }))));
  history.pushState(null, '', '/');
  render(<App />);
  const nav = await screen.findByRole('navigation');
  expect(nav.querySelectorAll('a')).toHaveLength(5);
  expect(nav.querySelector('[href="/c/palmeiras"]')).toBeTruthy();
});

test('/nova-senha abre a NovaSenha com ou sem sessão', async () => {
  history.pushState(null, '', '/nova-senha?token=t');
  vi.stubGlobal('fetch', vi.fn(async (u: string) => new Response(JSON.stringify(u === '/api/me' ? me : { itens: [], proximo: null }))));
  render(<App />);
  expect(await screen.findByRole('heading', { name: 'Nova senha' })).toBeTruthy();
  cleanup();
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 401 })));
  render(<App />);
  expect(await screen.findByRole('heading', { name: 'Nova senha' })).toBeTruthy();
});

test('sessão que expira numa chamada qualquer leva para /entrar', async () => {
  vi.stubGlobal('fetch', vi.fn(async (u: string) => (u === '/api/me' ? new Response(JSON.stringify(me)) : new Response(JSON.stringify({ itens: [], proximo: null })))));
  history.pushState(null, '', '/perfil');
  render(<App />);
  await screen.findByRole('navigation');
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ codigo: 'NAO_AUTENTICADO' }), { status: 401 })));
  const { api } = await import('./api/cliente');
  await api('/posts').catch(() => {});
  expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeTruthy();
  expect(location.pathname).toBe('/entrar');
});
