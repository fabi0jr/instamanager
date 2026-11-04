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

test('barra: Feed, Liga, Postar, Atividade, Perfil no celular; Galeria e Busca só na lateral (Galeria no topo do feed)', async () => {
  vi.stubGlobal('fetch', vi.fn(async (u: string) => new Response(JSON.stringify(u === '/api/me' ? me : { itens: [], proximo: null }))));
  history.pushState(null, '', '/');
  render(<App />);
  const nav = await screen.findByRole('navigation');
  const links = [...nav.querySelectorAll('a')];
  const rotulo = (a: Element) => a.querySelector('.rotulo')?.textContent;
  expect(links.filter((a) => !a.classList.contains('item-desktop')).map(rotulo)).toEqual(['Feed', 'Liga', 'Postar', 'Atividade', 'Perfil']);
  expect(links.filter((a) => a.classList.contains('item-desktop')).map(rotulo)).toEqual(['Galeria', 'Busca']); // só lateral
  expect(links.map(rotulo)).toEqual(['Feed', 'Liga', 'Postar', 'Galeria', 'Atividade', 'Busca', 'Perfil']); // ordem do desktop
  expect(nav.querySelector('[href="/atividade"]')).toBeTruthy();
  expect(nav.querySelector('[aria-current="page"]')?.getAttribute('href')).toBe('/');
  // Galeria e Busca também no topo do feed
  expect(document.querySelector('.topo-feed [href="/galeria"]')).toBeTruthy();
  expect(document.querySelector('.topo-feed [href="/busca"]')).toBeTruthy();
});

test('rota desconhecida /clubes/x e /atividade existem na barra sem tela em branco', async () => {
  vi.stubGlobal('fetch', vi.fn(async (u: string) => new Response(JSON.stringify(u === '/api/me' ? me : { itens: [], proximo: null }))));
  history.pushState(null, '', '/atividade');
  render(<App />);
  expect(await screen.findByRole('heading', { name: 'Atividade' })).toBeTruthy();
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
