import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import type { Me } from '../api/cliente';
import { fetchFalso } from '../testes/fetchFalso';
import { Liga } from './Liga';
import { diaHora, faltam } from './prazo';

const me: Me = { id: 'u1', nome: 'Lincoln', email: 'l@x.com', avatarUrl: null, isAdmin: false, pushEnabled: false, clube: null };
const c = (id: string) => ({ id, nome: id[0].toUpperCase() + id.slice(1), escudoUrl: `/escudos/${id}.svg` });
const base = { 'GET /liga/tabela': [], 'GET /liga/rodadas': [{ numero: 1, fechada: false, jogos: [{ id: 'j1', mandante: c('santos'), visitante: c('vasco'), golsMandante: 2, golsVisitante: 1 }, { id: 'j2', mandante: c('bahia'), visitante: c('remo'), golsMandante: null, golsVisitante: null }] }] };
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const abrir = (aba: string) => fireEvent.click(screen.getByRole('tab', { name: aba }));

test('abas da Liga: Tabela · Rodadas · Calendário · Copa · Bolão · Votações', async () => {
  fetchFalso(base);
  render(<Liga me={me} />);
  expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['Tabela', 'Rodadas', 'Calendário', 'Copa', 'Bolão', 'Votações']);
});

test('Rodadas só mostra jogo com placar; o agendado fica para o Calendário', async () => {
  fetchFalso(base);
  render(<Liga me={me} />);
  await screen.findByText('Rodada 1', { selector: 'h2' }).catch(() => null);
  abrir('Rodadas');
  await screen.findByRole('heading', { name: 'Rodada 1' });
  expect(document.querySelectorAll('.jogos li')).toHaveLength(1);
  expect(document.querySelector('.jogos li')!.textContent).toContain('2 × 1');
});

test('Calendário agrupa por rodada e fase, com prazo e link para palpitar', async () => {
  const prazo = new Date(Date.now() + 3 * 3600_000).toISOString();
  fetchFalso({
    ...base,
    'GET /liga/calendario': [
      { tipo: 'BRASILEIRAO', id: 'j2', rodada: 13, fase: null, prazoPalpite: prazo, mandante: c('bahia'), visitante: c('remo') },
      { tipo: 'COPA', id: 'cj1', rodada: null, fase: { id: 'f1', nome: 'Quartas' }, prazoPalpite: null, mandante: c('santos'), visitante: c('vasco') },
    ],
  });
  render(<Liga me={me} />);
  abrir('Calendário');
  const bra = await screen.findByRole('region', { name: 'Brasileirão · rodada 13' });
  expect(within(bra).getByText(/Palpite até/)).toBeTruthy();
  expect(within(bra).getByRole('link', { name: /Bahia contra Remo/ }).getAttribute('href')).toBe('/liga?aba=bolao&rodada=13');
  const copa = screen.getByRole('region', { name: 'Copa do Brasil · Quartas' });
  expect(within(copa).queryByText(/Palpite até/)).toBeNull(); // sem prazo, a linha some
  expect(within(copa).getByRole('link', { name: /Santos contra Vasco, Jogo único/ }).getAttribute('href')).toBe('/liga?aba=bolao&fase=f1');
});

test('Calendário vazio e com erro', async () => {
  let n = 0;
  fetchFalso({ ...base, 'GET /liga/calendario': () => (n++ ? [] : { status: 500, corpo: { codigo: 'ERRO' } }) });
  render(<Liga me={me} />);
  abrir('Calendário');
  fireEvent.click(await screen.findByRole('button', { name: 'Tentar de novo' }));
  expect(await screen.findByText('Nenhum jogo marcado')).toBeTruthy();
});

const jogoCopa = (extra = {}) => ({ id: 'cj1', mandante: c('santos'), visitante: c('vasco'), golsMandante: 1, golsVisitante: 1, penaltisMandante: 4, penaltisVisitante: 5, vencedor: c('vasco'), ...extra });

test('Copa: quem passou tem ok e texto, o eliminado também (não só cor) e os pênaltis aparecem', async () => {
  fetchFalso({
    ...base,
    'GET /copa': [
      { fase: { id: 'f1', nome: 'Oitavas', ordem: 1, prazoPalpite: null, fechada: true }, jogos: [jogoCopa()] },
      { fase: { id: 'f2', nome: 'Quartas', ordem: 2, prazoPalpite: new Date(Date.now() + 86400_000 * 3).toISOString(), fechada: false }, jogos: [jogoCopa({ id: 'cj2', golsMandante: null, golsVisitante: null, penaltisMandante: null, penaltisVisitante: null, vencedor: null })] },
    ],
  });
  render(<Liga me={me} />);
  abrir('Copa');
  const oitavas = await screen.findByRole('region', { name: 'Oitavas' });
  expect(within(oitavas).getByText('Fechada · jogo único')).toBeTruthy();
  expect(within(oitavas).getByText('Vasco passou')).toBeTruthy();
  expect(within(oitavas).getByText('Santos eliminado')).toBeTruthy();
  expect(within(oitavas).getByText('(5)')).toBeTruthy();
  expect(within(oitavas).getByText('Vasco passou nos pênaltis')).toBeTruthy();
  const quartas = screen.getByRole('region', { name: 'Quartas' });
  expect(within(quartas).getByText(/Palpite até/)).toBeTruthy();
  expect(quartas.querySelector('.passou, .eliminado')).toBeNull(); // sem placar: só os clubes
});

test('Copa sem fase mostra "A Copa ainda não começou"', async () => {
  fetchFalso({ ...base, 'GET /copa': [] });
  render(<Liga me={me} />);
  abrir('Copa');
  expect(await screen.findByText('A Copa ainda não começou')).toBeTruthy();
});

test('prazo: dias, horas e minutos abaixo de 24 h, e nulo depois', () => {
  const agora = Date.parse('2026-11-14T12:00:00Z');
  const em = (min: number) => new Date(agora + min * 60000).toISOString();
  expect(faltam(em(2 * 24 * 60 + 5), agora)).toBe('Faltam 2 dias.');
  expect(faltam(em(24 * 60), agora)).toBe('Falta 1 dia.');
  expect(faltam(em(80), agora)).toBe('Falta 1 h 20 min.');
  expect(faltam(em(5 * 60 + 3), agora)).toBe('Faltam 5 h 3 min.');
  expect(faltam(em(20), agora)).toBe('Falta 20 min.');
  expect(faltam(em(-1), agora)).toBeNull();
  expect(diaHora('2026-11-14T15:00:00Z')).toMatch(/^sáb 14\/11, \d{2}:\d{2}$/);
});
