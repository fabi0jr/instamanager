import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { BotaoReagir } from './Reacoes';

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const caixa = () => screen.getByRole('button', { name: 'Reagir' }).parentElement!;

test('mouse: pairar 400 ms abre o seletor e sair fecha', () => {
  render(<BotaoReagir minha={null} aoReagir={() => {}} />);
  fireEvent.pointerEnter(caixa(), { pointerType: 'mouse' });
  act(() => { vi.advanceTimersByTime(450); });
  expect(screen.getByRole('menu')).toBeTruthy();
  fireEvent.pointerLeave(caixa(), { pointerType: 'mouse' });
  expect(screen.queryByRole('menu')).toBeNull();
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
