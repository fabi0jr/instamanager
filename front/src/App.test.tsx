import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { App } from './App';

const me = { id: '1', nome: 'Lincoln', email: 'l@x.com', avatarUrl: null, isAdmin: false, pushEnabled: false, clube: null };
// aparelho que já passou pela tela de instalar/avisos (senão o 1º acesso logado abre /instalar; ver instalar/instalar.test.tsx)
beforeEach(() => localStorage.setItem('im:instalar-visto', '1'));
afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

test('sem sessão, qualquer rota privada mostra Entrar', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ codigo: 'NAO_AUTENTICADO', mensagem: '' }), { status: 401 })));
  history.pushState(null, '', '/p/abc');
  render(<App />);
  expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeTruthy();
  expect(screen.queryByRole('navigation')).toBeNull();
});

test('com sessão a barra tem 5 destinos no celular (Feed, Liga, Postar, Galeria, Perfil) e o Clube só na lateral; torcedor: Clube abre /clubes', async () => {
  vi.stubGlobal('fetch', vi.fn(async (u: string) => new Response(JSON.stringify(u === '/api/me' ? me : { itens: [], proximo: null }))));
  history.pushState(null, '', '/');
  render(<App />);
  const nav = await screen.findByRole('navigation');
  const links = [...nav.querySelectorAll('a')];
  expect(links.filter((a) => !a.classList.contains('item-desktop')).map((a) => a.querySelector('.rotulo')?.textContent)).toEqual(['Feed', 'Liga', 'Postar', 'Galeria', 'Perfil']);
  expect(links.filter((a) => a.classList.contains('item-desktop')).map((a) => a.querySelector('.rotulo')?.textContent)).toEqual(['Clube']); // só lateral
  expect([...nav.querySelectorAll('.rotulo')].map((e) => e.textContent)).toEqual(['Feed', 'Liga', 'Postar', 'Galeria', 'Clube', 'Perfil']); // ordem do desktop
  expect(nav.querySelector('[href="/liga"]')).toBeTruthy();
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
  expect(nav.querySelectorAll('a')).toHaveLength(6); // 5 do celular + Clube da lateral
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

test('barra: Postar usa o ícone novo-post (quadrado com +) e a lateral tem a marca', async () => {
  vi.stubGlobal('fetch', vi.fn(async (u: string) => new Response(JSON.stringify(u === '/api/me' ? me : { itens: [], proximo: null }))));
  history.pushState(null, '', '/galeria');
  render(<App />);
  const nav = await screen.findByRole('navigation');
  expect(nav.querySelector('a[href="/postar"] svg path')?.getAttribute('d')).toContain('M5 3h14');
  expect(nav.querySelector('.marca-lateral')?.textContent).toBe('InstaManager');
});

test('em /postar e /p/:id/editar a barra fica só no desktop (não cobre o botão fixo no celular)', async () => {
  vi.stubGlobal('fetch', vi.fn(async (u: string) => new Response(JSON.stringify(u === '/api/me' ? { ...me, clube: { id: 'palmeiras', nome: 'Palmeiras', escudoUrl: '' } } : { itens: [], proximo: null }))));
  history.pushState(null, '', '/postar');
  render(<App />);
  expect((await screen.findByRole('navigation', { name: 'Principal' })).className).toContain('so-desktop');
  cleanup();
  history.pushState(null, '', '/galeria');
  render(<App />);
  expect((await screen.findByRole('navigation', { name: 'Principal' })).className).not.toContain('so-desktop');
});
