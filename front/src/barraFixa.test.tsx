import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type { Me } from './api/cliente';
import { App } from './App';
import { BarraInferior } from './BarraInferior';
import { navegar } from './rotas';
import { montarRolagem } from './testes/rolagem';
import { Feed } from './feed/Feed';
import { fetchFalso } from './testes/fetchFalso';

const me: Me = { id: 'u1', nome: 'L', email: 'l@x.com', avatarUrl: null, isAdmin: false, pushEnabled: false, clube: null };
beforeEach(() => {
  vi.stubGlobal('IntersectionObserver', class { observe() {} disconnect() {} unobserve() {} });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const deslocados = (el: Element | null) => {
  const achados: Element[] = [];
  for (; el; el = el.parentElement) {
    const s = (el as HTMLElement).style;
    if (s.transform || s.translate || s.willChange || s.filter || s.perspective) achados.push(el);
  }
  return achados;
};

test('o puxar para atualizar desloca só a lista: nenhum ancestral da barra recebe transform/will-change', async () => {
  fetchFalso({ 'GET /posts': { itens: [], proximo: null } });
  render(<><main><Feed me={me} /></main><BarraInferior /></>);
  await screen.findByText('Ainda não tem post por aqui');
  fireEvent.touchStart(document, { touches: [{ clientY: 100 }] });
  fireEvent.touchMove(document, { touches: [{ clientY: 220 }] });
  await waitFor(() => expect(document.querySelector('.puxar')).not.toBeNull());
  expect(deslocados(screen.getByRole('navigation', { name: 'Principal' }))).toEqual([]);
  expect(document.querySelector('.puxar')?.contains(screen.getByRole('navigation', { name: 'Principal' }))).toBe(false);
  fireEvent.touchEnd(document);
});

test('CSS: a barra é fixed e nenhum wrapper do app (html, body, #root, main) tem transform ou vira o elemento rolável', () => {
  const css = readFileSync('src/tokens.css', 'utf8');
  expect(css).toMatch(/\.barra-inferior\s*\{[^}]*position:\s*fixed/);
  for (const seletor of ['html', 'body', '#root', 'main']) {
    const regras = [...css.matchAll(new RegExp(`(?:^|[},\\s])${seletor}\\s*(?:,[^{]*)?\\{([^}]*)\\}`, 'g'))].map((m) => m[1]).join(';');
    expect(regras, seletor).not.toMatch(/transform|will-change|filter|perspective/);
  }
});

test('CSS: o documento não rola e #rolagem é o contêiner rolável', () => {
  const css = readFileSync('src/tokens.css', 'utf8');
  expect(css).toMatch(/html,\s*body\s*\{[^}]*height:\s*100%[^}]*overflow:\s*hidden[^}]*overscroll-behavior:\s*none/);
  expect(css).toMatch(/#rolagem\s*\{[^}]*height:\s*100%[^}]*overflow-y:\s*auto[^}]*overscroll-behavior-y:\s*contain/);
});

const logado = { id: '1', nome: 'L', email: 'l@x.com', avatarUrl: null, isAdmin: false, pushEnabled: false, clube: null };
test('no App, a barra fica FORA do contêiner de rolagem (e as telas dentro dele); sem sessão não há barra', async () => {
  localStorage.setItem('im:instalar-visto', '1');
  vi.stubGlobal('fetch', vi.fn(async (u: string) => new Response(JSON.stringify(u === '/api/me' ? logado : { itens: [], proximo: null }))));
  history.pushState(null, '', '/');
  render(<App />);
  const nav = await screen.findByRole('navigation', { name: 'Principal' });
  const r = document.getElementById('rolagem')!;
  expect(r.contains(nav)).toBe(false);
  expect(r.querySelector('main')).not.toBeNull();
  localStorage.clear();
});

test('trocar de tela volta ao topo do contêiner; só mudar a query (?imagem=) não mexe na rolagem', () => {
  const { rolar, el } = montarRolagem();
  history.pushState(null, '', '/galeria');
  act(() => { dispatchEvent(new PopStateEvent('popstate')); }); // fixa o caminho atual como referência
  rolar(500, false);
  act(() => navegar('/galeria?imagem=x'));
  expect(el.scrollTop).toBe(500);
  act(() => navegar('/p/abc'));
  expect(el.scrollTop).toBe(0);
});

test('rolagem infinita observa o contêiner (root), não o documento', async () => {
  const roots: unknown[] = [];
  vi.stubGlobal('IntersectionObserver', class { constructor(_: unknown, o: IntersectionObserverInit) { roots.push(o.root); } observe() {} disconnect() {} unobserve() {} });
  const { el } = montarRolagem();
  const post = { id: 'a', clube: { id: 'p', nome: 'P', escudoUrl: '/e.svg' }, autor: { id: 'u2', nome: 'A' }, legenda: 'x', criadoEm: new Date().toISOString(), imagens: [{ id: 'ai', miniUrl: '/m.jpg', cheiaUrl: '/c.jpg', largura: 10, altura: 10, prompt: null }], curtidas: 0, curtiu: false, comentarios: 0, podeEditar: false };
  fetchFalso({ 'GET /posts': { itens: [post], proximo: 'c1' } });
  render(<Feed me={me} />, { container: el });
  await waitFor(() => expect(roots).toContain(el));
});
