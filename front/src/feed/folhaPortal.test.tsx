import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { Dialogo } from '../admin/Dialogo';
import { Folha } from './Folha';

beforeEach(() => {
  document.getElementById('rolagem')?.remove();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function comRolagem(ui: React.ReactNode) {
  const el = document.createElement('div');
  el.id = 'rolagem';
  document.body.append(el);
  return render(ui, { container: el });
}

test('Folha monta no document.body, fora do #rolagem (acima da barra inferior)', () => {
  comRolagem(<Folha titulo="Comentários" aoFechar={() => {}}><p>oi</p></Folha>);
  const dialogo = screen.getByRole('dialog', { name: 'Comentários' });
  expect(dialogo.closest('.veu')?.parentElement).toBe(document.body);
  expect(document.getElementById('rolagem')!.contains(dialogo)).toBe(false);
});

test('diálogo de confirmar (admin) também vai para o body', () => {
  comRolagem(<Dialogo titulo="Apagar?" texto="x" acao="Apagar" aoConfirmar={() => {}} aoVoltar={() => {}} />);
  expect(screen.getByRole('alertdialog').closest('.veu')?.parentElement).toBe(document.body);
});

test('Esc fecha só a folha de cima mesmo com portal (aninhada não é descendente no DOM)', () => {
  const a = vi.fn(), b = vi.fn();
  comRolagem(<Folha titulo="A" aoFechar={a}><Folha titulo="B" aoFechar={b}><p>x</p></Folha></Folha>);
  fireEvent.keyDown(document.body, { key: 'Escape' });
  expect(b).toHaveBeenCalledTimes(1);
  expect(a).not.toHaveBeenCalled();
});

test('o véu acompanha o visualViewport (teclado do iOS) e solta os ouvintes ao fechar', () => {
  const ouvintes: Record<string, () => void> = {};
  const vv = { offsetTop: 12, height: 400, addEventListener: vi.fn((n: string, f: () => void) => (ouvintes[n] = f)), removeEventListener: vi.fn() };
  vi.stubGlobal('visualViewport', vv);
  Object.defineProperty(window, 'visualViewport', { value: vv, configurable: true });
  const { unmount } = comRolagem(<Folha titulo="C" aoFechar={() => {}}><p>x</p></Folha>);
  const veu = document.querySelector<HTMLElement>('.veu')!;
  expect([veu.style.top, veu.style.height]).toEqual(['12px', '400px']);
  vv.height = 250; // teclado abriu
  act(() => ouvintes.resize());
  expect(veu.style.height).toBe('250px');
  unmount();
  expect(vv.removeEventListener).toHaveBeenCalledWith('resize', expect.any(Function));
  Object.defineProperty(window, 'visualViewport', { value: undefined, configurable: true });
});

test('CSS: o véu fica acima da barra (z-index) e cobre a tela inteira, escondendo a barra e a lateral', () => {
  const feed = readFileSync('src/feed/feed.css', 'utf8');
  const tokens = readFileSync('src/tokens.css', 'utf8');
  const z = (css: string, sel: RegExp) => Number(css.match(sel)?.[1]);
  const veu = z(feed, /\.veu\s*\{[^}]*z-index:\s*(\d+)/);
  const barra = z(tokens, /\.barra-inferior\s*\{[^}]*z-index:\s*(\d+)/);
  expect(veu).toBeGreaterThan(barra);
  expect(feed).toMatch(/\.veu\s*\{[^}]*position:\s*fixed;\s*inset:\s*0/);
});

test('CSS: setas do carrossel só com mouse de verdade (hover:hover e pointer:fine), não por largura', () => {
  const feed = readFileSync('src/feed/feed.css', 'utf8');
  expect(feed).toMatch(/@media \(hover: hover\) and \(pointer: fine\)\s*\{[^}]*\.seta/);
  expect(feed).not.toMatch(/@media \(min-width: 768px\)\s*\{\s*\.carrossel-moldura:hover/);
});
