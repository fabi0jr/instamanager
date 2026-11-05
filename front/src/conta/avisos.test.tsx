import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import type { Me } from '../api/cliente';
import { fetchFalso } from '../testes/fetchFalso';
import { Perfil } from './Perfil';

vi.mock('../instalar/push', () => ({ estadoPush: (ligado: boolean) => (ligado ? 'ligado' : 'desligado'), ativarPush: vi.fn(), desativarPush: vi.fn(), cancelarInscricaoAoSair: vi.fn() }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const me = (extra: Partial<Me> = {}): Me => ({ id: '1', nome: 'Lincoln', email: 'l@x.com', avatarUrl: null, isAdmin: false, pushEnabled: true, clube: null, ...extra });
const NOMES = ['Posts novos', 'Comentários no meu clube', 'Menções', 'CBF', 'Bolão', 'Trocas de clube'];

test('seis interruptores de aviso, todos ligados por padrão', async () => {
  fetchFalso({ 'GET /trocas/minhas': [] });
  render(<Perfil me={me()} recarregar={() => {}} />);
  for (const n of NOMES) expect(screen.getByRole('switch', { name: n }).getAttribute('aria-checked')).toBe('true');
});

test('desligar um salva na hora só aquela chave e mostra "Preferência salva."', async () => {
  const chamadas = fetchFalso({ 'GET /trocas/minhas': [], 'PATCH /me': me() });
  render(<Perfil me={me({ pushPrefs: { bolao: true } })} recarregar={() => {}} />);
  fireEvent.click(screen.getByRole('switch', { name: 'Bolão' }));
  expect(screen.getByRole('switch', { name: 'Bolão' }).getAttribute('aria-checked')).toBe('false'); // otimista
  expect(await screen.findByText('Preferência salva.')).toBeTruthy();
  const patch = chamadas.find((c) => c.chave === 'PATCH /me')!;
  expect(JSON.parse(patch.body as string)).toEqual({ pushPrefs: { bolao: false } });
});

test('falha ao salvar devolve o interruptor e avisa', async () => {
  fetchFalso({ 'GET /trocas/minhas': [], 'PATCH /me': { status: 500, corpo: { codigo: 'ERRO' } } });
  render(<Perfil me={me()} recarregar={() => {}} />);
  fireEvent.click(screen.getByRole('switch', { name: 'Menções' }));
  expect(await screen.findByText('Não deu para salvar. Tente de novo.')).toBeTruthy();
  await waitFor(() => expect(screen.getByRole('switch', { name: 'Menções' }).getAttribute('aria-checked')).toBe('true'));
});

test('com o mestre desligado os seis ficam inertes e esmaecidos', () => {
  fetchFalso({ 'GET /trocas/minhas': [] });
  render(<Perfil me={me({ pushEnabled: false })} recarregar={() => {}} />);
  expect(screen.getByText('Desligado. Ligue para escolher quais avisos chegam.')).toBeTruthy();
  const grupo = screen.getByRole('group', { name: 'Quais avisos receber', hidden: true });
  expect(grupo.className).toContain('inerte');
  expect(grupo.hasAttribute('inert')).toBe(true);
});
