import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type { Me } from '../api/cliente';
import { fetchFalso } from '../testes/fetchFalso';
import { Trocar } from './Trocar';

const palmeiras = { id: 'palmeiras', nome: 'Palmeiras', escudoUrl: '/escudos/palmeiras.svg' };
const torcedor: Me = { id: 'u1', nome: 'Lincoln', email: 'l@x.com', avatarUrl: null, isAdmin: false, pushEnabled: false, clube: null };
const tecnico: Me = { ...torcedor, clube: palmeiras };
const livre = (id: string, nome: string) => ({ id, nome, escudoUrl: `/escudos/${id}.svg`, tecnico: null });
const livres = [livre('flamengo', 'Flamengo'), livre('santos', 'Santos')];
const pendente = { id: 't1', tipo: 'ASSUMIR', clubeId: 'flamengo', status: 'PENDENTE', criadoEm: new Date().toISOString(), decididoEm: null };
const decidida = { ...pendente, id: 't0', status: 'RECUSADA' };

beforeEach(() => history.replaceState(null, '', '/trocar'));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
const clica = (nome: string) => fireEvent.click(screen.getByRole('button', { name: nome }));
const nomes = () => screen.getAllByRole('radio').map((r) => r.textContent?.replace('✓', ''));

test('pedido pendente mostra status e bloqueia novo pedido', async () => {
  const chamadas = fetchFalso({ 'GET /trocas/minhas': [decidida, pendente] });
  render(<Trocar me={tecnico} />);
  expect(await screen.findByText('Você já tem um pedido pendente. Espere a resposta do admin.')).toBeTruthy();
  expect(screen.queryByRole('radio')).toBeNull();
  expect(screen.getByRole('button', { name: 'Voltar ao perfil' })).toBeTruthy();
  expect(chamadas.map((c) => c.chave)).toEqual(['GET /trocas/minhas']); // nem busca os clubes
});

test('só pedido já decidido não bloqueia', async () => {
  fetchFalso({ 'GET /trocas/minhas': [decidida], 'GET /clubes?livres=1': livres });
  render(<Trocar me={torcedor} />);
  expect(await screen.findByRole('radiogroup', { name: 'Clube' })).toBeTruthy();
});

test('ASSUMIR lista só clubes livres (pede ?livres=1); torcedor não vê "Sair"', async () => {
  const chamadas = fetchFalso({ 'GET /trocas/minhas': [], 'GET /clubes?livres=1': livres });
  render(<Trocar me={torcedor} />);
  await screen.findByRole('radiogroup', { name: 'Clube' });
  expect(chamadas.map((c) => c.chave)).toContain('GET /clubes?livres=1');
  expect(nomes()).toEqual(['Flamengo', 'Santos']);
  expect(screen.getByRole('heading', { name: 'Pedir um clube' })).toBeTruthy();
  expect((screen.getByRole('button', { name: 'Pedir clube' }) as HTMLButtonElement).disabled).toBe(true);
});

test('técnico vê as duas opções; Assumir já vem escolhida e o texto diz que continua no clube', async () => {
  fetchFalso({ 'GET /trocas/minhas': [], 'GET /clubes?livres=1': livres });
  render(<Trocar me={tecnico} />);
  await screen.findByRole('radiogroup', { name: 'Clube' });
  expect(screen.getByRole('heading', { name: 'Trocar de clube' })).toBeTruthy();
  expect(screen.getByText(/continua no Palmeiras/)).toBeTruthy();
  const modo = within(screen.getByRole('radiogroup', { name: 'O que fazer' })).getAllByRole('radio');
  expect(modo.map((r) => r.textContent)).toEqual(expect.arrayContaining([expect.stringContaining('Sair do Palmeiras'), expect.stringContaining('Assumir outro clube')]));
  expect(modo[1].getAttribute('aria-checked')).toBe('true');
});

test('assumir envia {tipo, clubeId} e mostra "Pedido enviado"', async () => {
  const chamadas = fetchFalso({ 'GET /trocas/minhas': [], 'GET /clubes?livres=1': livres, 'POST /trocas': { status: 201, corpo: pendente } });
  render(<Trocar me={torcedor} />);
  fireEvent.click(await screen.findByRole('radio', { name: 'Santos' }));
  clica('Pedir clube');
  expect(await screen.findByText('Pedido enviado')).toBeTruthy();
  const post = chamadas.find((c) => c.chave === 'POST /trocas')!;
  expect(JSON.parse(post.body as string)).toEqual({ tipo: 'ASSUMIR', clubeId: 'santos' });
  expect(screen.getByRole('button', { name: 'Voltar ao perfil' })).toBeTruthy();
});

test('sair envia {tipo: SAIR} e esconde a lista de clubes', async () => {
  const chamadas = fetchFalso({ 'GET /trocas/minhas': [], 'GET /clubes?livres=1': livres, 'POST /trocas': { status: 201, corpo: { ...pendente, tipo: 'SAIR', clubeId: null } } });
  render(<Trocar me={tecnico} />);
  fireEvent.click(await screen.findByRole('radio', { name: /Sair do Palmeiras/ }));
  expect(screen.queryByRole('radiogroup', { name: 'Clube' })).toBeNull();
  clica('Pedir troca');
  await screen.findByText('Pedido enviado');
  expect(JSON.parse(chamadas.find((c) => c.chave === 'POST /trocas')!.body as string)).toEqual({ tipo: 'SAIR' });
});

test('?clube= abre com o clube já escolhido', async () => {
  history.replaceState(null, '', '/trocar?clube=santos');
  fetchFalso({ 'GET /trocas/minhas': [], 'GET /clubes?livres=1': livres });
  render(<Trocar me={torcedor} />);
  const santos = await screen.findByRole('radio', { name: 'Santos' });
  expect(santos.getAttribute('aria-checked')).toBe('true');
  expect((screen.getByRole('button', { name: 'Pedir clube' }) as HTMLButtonElement).disabled).toBe(false);
});

test('409 CLUBE_OCUPADO → aviso com o clube, a lista recarrega sem ele e nada fica escolhido', async () => {
  let ciclo = 0;
  fetchFalso({
    'GET /trocas/minhas': [],
    'GET /clubes?livres=1': () => (ciclo++ === 0 ? livres : [livre('santos', 'Santos')]),
    'POST /trocas': { status: 409, corpo: { codigo: 'CLUBE_OCUPADO', mensagem: 'x' } },
  });
  render(<Trocar me={torcedor} />);
  fireEvent.click(await screen.findByRole('radio', { name: 'Flamengo' }));
  clica('Pedir clube');
  expect((await screen.findByRole('alert')).textContent).toContain('O Flamengo acabou de ganhar um técnico. Escolha outro clube.');
  await waitFor(() => expect(nomes()).toEqual(['Santos']));
  expect(screen.getByRole('radio', { name: 'Santos' }).getAttribute('aria-checked')).toBe('false');
  expect((screen.getByRole('button', { name: 'Pedir clube' }) as HTMLButtonElement).disabled).toBe(true);
});

test('409 TROCA_PENDENTE no envio → tela de pedido pendente', async () => {
  fetchFalso({ 'GET /trocas/minhas': [], 'GET /clubes?livres=1': livres, 'POST /trocas': { status: 409, corpo: { codigo: 'TROCA_PENDENTE', mensagem: 'x' } } });
  render(<Trocar me={torcedor} />);
  fireEvent.click(await screen.findByRole('radio', { name: 'Santos' }));
  clica('Pedir clube');
  expect(await screen.findByText('Você já tem um pedido pendente. Espere a resposta do admin.')).toBeTruthy();
});

test('SEM_CLUBE ao sair → "Você já está sem clube."', async () => {
  fetchFalso({ 'GET /trocas/minhas': [], 'GET /clubes?livres=1': livres, 'POST /trocas': { status: 403, corpo: { codigo: 'SEM_CLUBE', mensagem: 'x' } } });
  render(<Trocar me={tecnico} />);
  fireEvent.click(await screen.findByRole('radio', { name: /Sair do Palmeiras/ }));
  clica('Pedir troca');
  expect((await screen.findByRole('alert')).textContent).toContain('Você já está sem clube.');
});

test('sem clubes livres: técnico ainda pode sair; torcedor só volta', async () => {
  fetchFalso({ 'GET /trocas/minhas': [], 'GET /clubes?livres=1': [] });
  render(<Trocar me={tecnico} />);
  expect(await screen.findByText('Nenhum clube livre agora')).toBeTruthy();
  expect(screen.getByText('Quando um clube ficar sem técnico, ele aparece aqui.')).toBeTruthy();
  expect(screen.getByRole('radio', { name: /Sair do Palmeiras/ })).toBeTruthy();
  cleanup();

  fetchFalso({ 'GET /trocas/minhas': [], 'GET /clubes?livres=1': [] });
  render(<Trocar me={torcedor} />);
  expect(await screen.findByText('Nenhum clube livre agora')).toBeTruthy();
  expect(screen.queryByRole('radio')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Pedir clube' })).toBeNull();
});

test('erro ao carregar → "Tentar de novo" refaz a busca', async () => {
  let n = 0;
  fetchFalso({ 'GET /trocas/minhas': [], 'GET /clubes?livres=1': () => (n++ === 0 ? { status: 500, corpo: {} } : livres) });
  render(<Trocar me={torcedor} />);
  expect(await screen.findByText('Não deu para carregar os clubes')).toBeTruthy();
  clica('Tentar de novo');
  expect(await screen.findByRole('radio', { name: 'Flamengo' })).toBeTruthy();
});
