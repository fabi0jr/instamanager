import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { BotaoReagir } from './Reacoes';

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const caixa = () => screen.getByRole('button', { name: 'Reagir' }).parentElement!;

test('mouse: parado 450 ms abre o seletor; sair fecha só depois de 300 ms', () => {
  render(<BotaoReagir minha={null} aoReagir={() => {}} />);
  fireEvent.pointerEnter(caixa(), { pointerType: 'mouse' });
  act(() => { vi.advanceTimersByTime(440); });
  expect(screen.queryByRole('menu')).toBeNull(); // ainda não deu a intenção
  act(() => { vi.advanceTimersByTime(20); });
  expect(screen.getByRole('menu')).toBeTruthy();
  fireEvent.pointerLeave(caixa(), { pointerType: 'mouse' });
  expect(screen.getByRole('menu')).toBeTruthy(); // não fecha na hora
  act(() => { vi.advanceTimersByTime(310); });
  expect(screen.queryByRole('menu')).toBeNull();
});

// conta quantas vezes o seletor foi montado (loop de abrir/fechar = várias montagens)
function contarMontagens() {
  let n = 0;
  const obs = new MutationObserver((ms) => ms.forEach((m) => m.addedNodes.forEach((no) => { if (no instanceof Element && (no.getAttribute('role') === 'menu' || no.querySelector('[role=menu]'))) n++; })));
  obs.observe(document.body, { childList: true, subtree: true });
  return { total: () => { obs.takeRecords().forEach(() => {}); return n; }, parar: () => obs.disconnect() };
}

test('passar do botão para o seletor (sai e entra dentro de 300 ms) NÃO fecha nem remonta: sem loop', async () => {
  render(<BotaoReagir minha={null} aoReagir={() => {}} />);
  const m = contarMontagens();
  fireEvent.pointerEnter(caixa(), { pointerType: 'mouse' });
  act(() => { vi.advanceTimersByTime(460); });
  for (let i = 0; i < 5; i++) { // vai e volta pelo vão várias vezes
    fireEvent.pointerLeave(caixa(), { pointerType: 'mouse' });
    act(() => { vi.advanceTimersByTime(100); });
    fireEvent.pointerEnter(caixa(), { pointerType: 'mouse' });
    act(() => { vi.advanceTimersByTime(100); });
  }
  act(() => { vi.advanceTimersByTime(2000); });
  await Promise.resolve();
  expect(screen.getByRole('menu')).toBeTruthy();
  expect(m.total()).toBe(1);
  m.parar();
});

test('sair do botão e do seletor fecha uma vez só e não reabre sozinho', async () => {
  render(<BotaoReagir minha={null} aoReagir={() => {}} />);
  const m = contarMontagens();
  fireEvent.pointerEnter(caixa(), { pointerType: 'mouse' });
  act(() => { vi.advanceTimersByTime(460); });
  fireEvent.pointerLeave(caixa(), { pointerType: 'mouse' });
  act(() => { vi.advanceTimersByTime(5000); });
  await Promise.resolve();
  expect(screen.queryByRole('menu')).toBeNull();
  expect(m.total()).toBe(1);
  m.parar();
});

test('clicar no ❤️ só reage e nunca reabre o seletor (nem com timer de abrir pendente)', () => {
  const reagir = vi.fn();
  render(<BotaoReagir minha={null} aoReagir={reagir} />);
  fireEvent.pointerEnter(caixa(), { pointerType: 'mouse' });
  act(() => { vi.advanceTimersByTime(200); }); // ainda sem abrir...
  fireEvent.click(screen.getByRole('button', { name: 'Reagir' })); // ...e já clica
  act(() => { vi.advanceTimersByTime(3000); });
  expect(reagir).toHaveBeenCalledWith('❤️');
  expect(screen.queryByRole('menu')).toBeNull();
});

test('clicar no ❤️ com o seletor aberto reage e fecha, sem reabrir', () => {
  const reagir = vi.fn();
  render(<BotaoReagir minha={null} aoReagir={reagir} />);
  fireEvent.pointerEnter(caixa(), { pointerType: 'mouse' });
  act(() => { vi.advanceTimersByTime(460); });
  expect(screen.getByRole('menu')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Reagir' }));
  act(() => { vi.advanceTimersByTime(3000); });
  expect(reagir).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole('menu')).toBeNull();
});

test('CSS: ponte invisível cobre o vão entre o botão e o seletor', async () => {
  const { readFileSync } = await import('node:fs');
  expect(readFileSync('src/feed/feed.css', 'utf8')).toMatch(/\.seletor::after\s*\{[^}]*top:\s*100%[^}]*height:/);
});

test('toque: o mouseenter/pointerenter emulado no celular NÃO abre o seletor num toque curto', () => {
  const reagir = vi.fn();
  render(<BotaoReagir minha={null} aoReagir={reagir} />);
  fireEvent.pointerEnter(caixa(), { pointerType: 'touch' });
  fireEvent.mouseEnter(caixa());
  fireEvent.click(screen.getByRole('button', { name: 'Reagir' }));
  act(() => { vi.advanceTimersByTime(1000); });
  expect(screen.queryByRole('menu')).toBeNull();
  expect(reagir).toHaveBeenCalledWith('❤️');
});

test("botão de acessibilidade 'Mais reações' abre o seletor", () => {
  render(<BotaoReagir minha={null} aoReagir={() => {}} />);
  fireEvent.click(screen.getByRole('button', { name: 'Mais reações' }));
  expect(screen.getByRole('menu')).toBeTruthy();
});
