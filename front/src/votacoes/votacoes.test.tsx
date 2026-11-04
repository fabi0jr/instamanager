import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { fetchFalso } from '../testes/fetchFalso';
import type { Votacao } from './tipos';
import { ListaVotacoes, Votar } from './Votacoes';

const vot = (extra: Partial<Votacao> = {}): Votacao => ({
  id: 'v1', titulo: 'Técnico do mês', tipo: 'CLUBE', prazo: new Date(Date.now() + 2 * 86400_000).toISOString(), aberta: true, encerrada: false,
  opcoes: [{ id: 'flamengo', rotulo: 'Flamengo' }, { id: 'palmeiras', rotulo: 'Palmeiras' }], meuVoto: null, ...extra,
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

test('votar 1x mostra "Seu voto foi registrado" e trava as opções', async () => {
  const chamadas = fetchFalso({ 'GET /votacoes/v1': vot(), 'POST /votacoes/v1/voto': { status: 204 } });
  render(<Votar id="v1" />);
  const confirmar = await screen.findByRole('button', { name: 'Confirmar voto' }) as HTMLButtonElement;
  expect(confirmar.disabled).toBe(true);
  fireEvent.click(screen.getByRole('radio', { name: 'Palmeiras' }));
  fireEvent.click(confirmar);
  await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Seu voto foi registrado.'));
  expect(chamadas.find((c) => c.chave === 'POST /votacoes/v1/voto')!.body).toBe(JSON.stringify({ opcao: 'palmeiras' }));
  expect(screen.getByText(/Seu voto está guardado/)).toBeTruthy();
  expect((screen.getByRole('radio', { name: /Flamengo/ }) as HTMLButtonElement).disabled).toBe(true);
  expect(screen.queryByRole('button', { name: 'Confirmar voto' })).toBeNull();
});

test('votar de novo (JA_VOTOU) avisa; prazo vencido desabilita', async () => {
  fetchFalso({ 'GET /votacoes/v1': vot(), 'POST /votacoes/v1/voto': { status: 409, corpo: { codigo: 'JA_VOTOU' } } });
  render(<Votar id="v1" />);
  fireEvent.click(await screen.findByRole('radio', { name: 'Flamengo' }));
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar voto' }));
  expect(await screen.findByText('Você já votou nesta votação.')).toBeTruthy();
  cleanup();
  fetchFalso({ 'GET /votacoes/v1': vot({ aberta: false }) });
  render(<Votar id="v1" />);
  expect(await screen.findByText(/O prazo acabou/)).toBeTruthy();
  expect((screen.getByRole('button', { name: 'Votação encerrada' }) as HTMLButtonElement).disabled).toBe(true);
});

test('resultado só depois de encerrar: antes não há porcentagem; depois mostra barras, seu voto e o selo', async () => {
  fetchFalso({ 'GET /votacoes/v1': vot({ meuVoto: 'flamengo' }) });
  render(<Votar id="v1" />);
  await screen.findByText(/Seu voto está guardado/);
  expect(screen.queryByText(/%/)).toBeNull();
  cleanup();
  fetchFalso({ 'GET /votacoes/v1': vot({ aberta: false, encerrada: true, meuVoto: 'flamengo', resultado: [{ opcao: 'flamengo', rotulo: 'Flamengo', votos: 3 }, { opcao: 'palmeiras', rotulo: 'Palmeiras', votos: 1 }] }) });
  render(<Votar id="v1" />);
  expect(await screen.findByText('4 votos · resultado final')).toBeTruthy();
  expect(screen.getByLabelText('75%, 3 votos')).toBeTruthy();
  expect(screen.getByText(/seu voto/)).toBeTruthy();
  expect(screen.getByText('Selo para Flamengo, agora no perfil do clube.')).toBeTruthy();
});

test('lista da Liga mostra também as encerradas com "Venceu: X"', async () => {
  const enc = vot({ id: 'v0', titulo: 'Clube de outubro', aberta: false, encerrada: true, vencedor: 'Flamengo', resultado: [{ opcao: 'flamengo', rotulo: 'Flamengo', votos: 3 }, { opcao: 'palmeiras', rotulo: 'Palmeiras', votos: 1 }] });
  fetchFalso({ 'GET /votacoes': [vot()], 'GET /votacoes?encerradas=1': [enc] });
  render(<ListaVotacoes />);
  expect(await screen.findByText('Venceu: Flamengo')).toBeTruthy();
  expect(screen.getByRole('link', { name: /Clube de outubro/ }).getAttribute('href')).toBe('/votacoes/v0');
  expect(screen.getByText('Técnico do mês')).toBeTruthy();
});
