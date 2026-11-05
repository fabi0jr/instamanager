import { readFileSync } from 'node:fs';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import type { Me } from '../api/cliente';
import { fetchFalso } from '../testes/fetchFalso';
import { Liga } from './Liga';

const me: Me = { id: 'u1', nome: 'Lincoln', email: 'l@x.com', avatarUrl: null, isAdmin: false, pushEnabled: false, clube: { id: 'santos', nome: 'Santos', escudoUrl: '/escudos/santos.svg' } };
const clubes = ['palmeiras', 'flamengo', 'santos', 'vasco', 'bahia', 'gremio'];
const linha = (id: string, i: number, extra = {}) => ({ clubeId: id, nome: id[0].toUpperCase() + id.slice(1), posicao: i + 1, P: 20 - i * 3, J: 8, V: 6 - i, E: 1, D: 1, GP: 10, GC: 5, SG: 5 - i, ultimos: ['V', 'D', 'E'], ...extra });
const tabela = clubes.map((c, i) => linha(c, i));
const c = (id: string) => ({ id, nome: id[0].toUpperCase() + id.slice(1), escudoUrl: `/escudos/${id}.svg` });
const rodadas = [
  { numero: 1, fechada: true, jogos: [{ id: 'j1', mandante: c('palmeiras'), visitante: c('flamengo'), golsMandante: 3, golsVisitante: 0 }] },
  { numero: 2, fechada: false, jogos: [{ id: 'j2', mandante: c('santos'), visitante: c('vasco'), golsMandante: 1, golsVisitante: 1 }] },
  { numero: 3, fechada: false, jogos: [] },
];
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

test('Liga mostra tabela ordenada e zonas', async () => {
  fetchFalso({ 'GET /liga/tabela': tabela, 'GET /liga/rodadas': rodadas });
  render(<Liga me={me} />);
  expect(await screen.findByText('Rodada 1 de 38 · só rodadas fechadas contam')).toBeTruthy();
  const corpo = screen.getAllByRole('row').slice(1);
  expect(corpo.map((r) => within(r).getByRole('rowheader').textContent)).toEqual(['1', '2', '3', '4', '5', '6']);
  expect(corpo[0].className).toContain('topo');
  expect(corpo[5].className).toContain('rebaixa');
  expect(corpo[2].className).toContain('meu'); // Santos, o clube da pessoa
  // do mais velho ao mais novo e nunca só a cor
  expect(corpo[0].getAttribute('aria-label')).toBe('1º Palmeiras, 20 pontos, últimos 3: empate, derrota, vitória');
  expect(within(corpo[0]).getByRole('link', { name: 'Palmeiras' }).getAttribute('href')).toBe('/c/palmeiras');
  expect(screen.getByText(/Rebaixamento/)).toBeTruthy();
  expect(screen.getByRole('columnheader', { name: 'P' }).getAttribute('aria-sort')).toBe('descending');
});

test('sem rodada fechada: cartão "Nenhuma rodada fechada ainda" e sem zonas', async () => {
  fetchFalso({ 'GET /liga/tabela': tabela.map((l) => ({ ...l, P: 0, ultimos: [] })), 'GET /liga/rodadas': rodadas.map((r) => ({ ...r, fechada: false })) });
  render(<Liga me={me} />);
  expect(await screen.findByText('Nenhuma rodada fechada ainda')).toBeTruthy();
  expect(screen.getAllByRole('row')[1].className).not.toContain('topo');
});

test('erro mostra "Tentar de novo" e recarrega', async () => {
  let n = 0;
  fetchFalso({ 'GET /liga/tabela': () => (n++ === 0 ? { status: 500, corpo: {} } : tabela), 'GET /liga/rodadas': rodadas });
  render(<Liga me={me} />);
  expect(await screen.findByText('Não deu para carregar a tabela')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
  expect(await screen.findByText('Palmeiras')).toBeTruthy();
});

test('rodadas listam resultados, com aviso de parcial na aberta e "Faltam jogos" na vazia', async () => {
  fetchFalso({ 'GET /liga/tabela': tabela, 'GET /liga/rodadas': rodadas });
  render(<Liga me={me} />);
  await screen.findByText('Palmeiras');
  fireEvent.click(screen.getByRole('tab', { name: 'Rodadas' }));
  expect(screen.getByRole('heading', { name: 'Rodada 1' })).toBeTruthy(); // abre na última fechada
  expect(screen.getByText('Fechada')).toBeTruthy();
  expect(screen.getByLabelText('Palmeiras 3, Flamengo 0').textContent).toContain('3 × 0');
  fireEvent.click(screen.getByRole('button', { name: 'Rodada 2' }));
  expect(screen.getByText('Em andamento')).toBeTruthy();
  expect(screen.getByText('Placar parcial. Só vale na tabela depois que o admin fechar a rodada.')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Rodada 3' }));
  expect(screen.getByText('Faltam jogos a lançar')).toBeTruthy();
});

test('faixa de abas: só rola na horizontal, sem puxar a página (estilos e #rolagem intactos)', async () => {
  fetchFalso({ 'GET /liga/tabela': tabela, 'GET /liga/rodadas': rodadas, 'GET /copa': [], 'GET /bolao/meus?rodada=1': [], 'GET /votacoes': [] });
  const css = readFileSync('src/liga/liga.css', 'utf8');
  const regra = css.match(/\.abas-liga \{[^}]*\}/)![0];
  for (const d of ['overflow-x: auto', 'overflow-y: hidden', 'overscroll-behavior-x: contain', 'touch-action: pan-x', 'scroll-snap-type: x proximity', 'scroll-padding-inline', 'scrollbar-width: none']) expect(regra).toContain(d);
  expect(css).toMatch(/\.abas-liga button \{ scroll-snap-align: center;/);
  const { container } = render(<div id="rolagem"><Liga me={me} /></div>);
  const rolagem = container.querySelector('#rolagem') as HTMLElement;
  rolagem.scrollTop = 120;
  fireEvent.click(await screen.findByRole('tab', { name: 'Copa' }));
  fireEvent.click(screen.getByRole('tab', { name: 'Bolão' }));
  expect(rolagem.scrollTop).toBe(120);
});
