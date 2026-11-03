import { render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { App } from './App';

const me = { id: '1', nome: 'Lincoln', email: 'l@x.com', avatarUrl: null, isAdmin: false, pushEnabled: false, clube: null };
afterEach(() => vi.unstubAllGlobals());

test('sem sessão, qualquer rota privada mostra Entrar', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ codigo: 'NAO_AUTENTICADO', mensagem: '' }), { status: 401 })));
  history.pushState(null, '', '/p/abc');
  render(<App />);
  expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeTruthy();
  expect(screen.queryByRole('navigation')).toBeNull();
});

test('com sessão mostra a barra inferior com 5 destinos', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(me))));
  history.pushState(null, '', '/');
  render(<App />);
  const nav = await screen.findByRole('navigation');
  expect(nav.querySelectorAll('a')).toHaveLength(5);
  expect(nav.querySelector('[aria-current="page"]')?.getAttribute('href')).toBe('/');
});
