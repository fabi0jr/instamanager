import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type { Me } from './api/cliente';
import { BarraInferior } from './BarraInferior';
import { Feed } from './feed/Feed';
import { fetchFalso } from './testes/fetchFalso';

const me: Me = { id: 'u1', nome: 'L', email: 'l@x.com', avatarUrl: null, isAdmin: false, pushEnabled: false, clube: null };
beforeEach(() => {
  window.scrollTo = vi.fn();
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
    expect(regras, seletor).not.toMatch(/transform|will-change|filter|overflow|perspective|(?<!min-)height:\s*100/);
  }
});
