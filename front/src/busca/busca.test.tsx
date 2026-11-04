import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { fetchFalso } from '../testes/fetchFalso';
import { Busca } from './Busca';
import { Destaque } from './destaque';

const clube = { id: 'palmeiras', nome: 'Palmeiras', escudoUrl: '/escudos/palmeiras.svg' };
beforeEach(() => vi.stubGlobal('IntersectionObserver', class { observe() {} disconnect() {} unobserve() {} }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers(); });
const digitar = (v: string) => fireEvent.change(screen.getByLabelText('Buscar'), { target: { value: v } });

test('busca com abas e "digite 2 letras"; 1 letra não chama a API', async () => {
  const chamadas = fetchFalso({ 'GET /busca?q=contratacao&tipo=posts': { itens: [], proximo: null } });
  render(<Busca />);
  expect(screen.getByText('Digite ao menos 2 letras')).toBeTruthy();
  expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['Posts', 'Prompts', 'Clubes', 'Pessoas']);
  digitar('c');
  expect(screen.getByText('Falta mais uma letra para buscar.')).toBeTruthy();
  await new Promise((r) => setTimeout(r, 400));
  expect(chamadas).toHaveLength(0);
  digitar('contratacao');
  expect(await screen.findByText('Nada achado para “contratacao”')).toBeTruthy();
});

test('resultado de clube abre /c/:id e a aba escolhida fica ao trocar o termo', async () => {
  fetchFalso({
    'GET /busca?q=pal&tipo=clubes': { itens: [{ ...clube, tecnico: { id: 'u1', nome: 'Lincoln' } }], proximo: null },
    'GET /busca?q=palm&tipo=clubes': { itens: [{ ...clube, tecnico: null }], proximo: null },
  });
  render(<Busca />);
  fireEvent.click(screen.getByRole('tab', { name: 'Clubes' }));
  digitar('pal');
  const link = await screen.findByRole('link', { name: /Palmeiras/ });
  expect(link.getAttribute('href')).toBe('/c/palmeiras');
  expect(screen.getByText('técnico Lincoln')).toBeTruthy();
  digitar('palm');
  expect(await screen.findByText('vaga aberta')).toBeTruthy();
  expect(screen.getByRole('tab', { name: 'Clubes' }).getAttribute('aria-selected')).toBe('true');
});

test('erro de busca mostra "Tentar de novo"', async () => {
  fetchFalso({ 'GET /busca?q=zz&tipo=posts': { status: 500, corpo: {} } });
  render(<Busca />);
  digitar('zz');
  expect(await screen.findByText('Não deu para buscar')).toBeTruthy();
  await waitFor(() => expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeTruthy());
});

test('destaque ignora acento e maiúscula e marca a palavra inteira', () => {
  render(<p><Destaque texto="Nova Contratação do Santos" q="contratacao" /></p>);
  expect(document.querySelector('b')?.textContent).toBe('Contratação');
  cleanup();
  render(<p><Destaque texto="sem nada" q="xyz" /></p>);
  expect(document.querySelector('b')).toBeNull();
});

test('pessoa com clube leva a /c/:clubeId e o torcedor fica sem link', async () => {
  fetchFalso({ 'GET /busca?q=fa&tipo=pessoas': { itens: [{ id: 'u1', nome: 'Fabio', avatarUrl: null, clube }, { id: 'u2', nome: 'Fabiana', avatarUrl: null, clube: null }], proximo: null } });
  render(<Busca />);
  fireEvent.click(screen.getByRole('tab', { name: 'Pessoas' }));
  digitar('fa');
  await screen.findByText('torcedor');
  expect(screen.getAllByRole('link').map((a) => a.getAttribute('href'))).toEqual(['/c/palmeiras']);
});
