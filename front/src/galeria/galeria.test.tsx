import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { fetchFalso } from '../testes/fetchFalso';
import { Galeria } from './Galeria';

const clube = { id: 'palmeiras', nome: 'Palmeiras', escudoUrl: '/escudos/palmeiras.svg' };
const item = (id: string, postId = 'p1') => ({ imagemId: id, postId, miniUrl: `/${id}-mini.jpg`, cheiaUrl: `/${id}.jpg`, prompt: 'um gol  de bicicleta\ncom "aspas"', clube });
const postDe = (id: string) => ({
  id, clube, autor: { id: 'u1', nome: 'Abel' }, legenda: '', criadoEm: new Date().toISOString(), curtidas: 0, curtiu: false, comentarios: 0, podeEditar: false,
  imagens: [
    { id: 'i1', miniUrl: '/i1-mini.jpg', cheiaUrl: '/i1.jpg', largura: 10, altura: 10, prompt: 'um gol  de bicicleta\ncom "aspas"' },
    { id: 'i2', miniUrl: '/i2-mini.jpg', cheiaUrl: '/i2.jpg', largura: 10, altura: 10, prompt: null },
    { id: 'i3', miniUrl: '/i3-mini.jpg', cheiaUrl: '/i3.jpg', largura: 10, altura: 10, prompt: 'segundo prompt' },
  ],
});

beforeEach(() => {
  vi.stubGlobal('IntersectionObserver', class { observe() {} disconnect() {} });
  history.pushState(null, '', '/galeria');
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

test('galeria: tocar abre o detalhe e "Copiar prompt" chama writeText com o texto exato', async () => {
  fetchFalso({ 'GET /galeria': { itens: [item('i1')], proximo: null }, 'GET /posts/p1': postDe('p1') });
  const writeText = vi.fn(async () => {});
  vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
  render(<Galeria />);
  fireEvent.click(await screen.findByRole('link', { name: /Prompt de Palmeiras/ }));
  await screen.findByRole('dialog', { name: 'Detalhe do prompt' });
  expect(location.search).toBe('?imagem=i1&post=p1');
  expect(await screen.findByText('Imagem 1 de 2')).toBeTruthy(); // só as imagens com prompt
  fireEvent.click(screen.getByRole('button', { name: 'Copiar prompt' }));
  await waitFor(() => expect(writeText).toHaveBeenCalledWith('um gol  de bicicleta\ncom "aspas"'));
  expect(await screen.findByRole('button', { name: 'Prompt copiado' })).toBeTruthy();
  expect(screen.getByRole('status').textContent).toContain('Prompt copiado para a área de transferência');
});

test('copiar bloqueado mostra a instrução em vez de alert', async () => {
  fetchFalso({ 'GET /galeria': { itens: [item('i1')], proximo: null }, 'GET /posts/p1': postDe('p1') });
  vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText: vi.fn(async () => Promise.reject(new Error('bloqueado'))) } });
  history.pushState(null, '', '/galeria?imagem=i1&post=p1');
  render(<Galeria />);
  fireEvent.click(await screen.findByRole('button', { name: 'Copiar prompt' }));
  expect(await screen.findByText('Toque e segure no texto para copiar.')).toBeTruthy();
});

test('← → trocam entre as imagens com prompt do mesmo post', async () => {
  fetchFalso({ 'GET /galeria': { itens: [], proximo: null }, 'GET /posts/p1': postDe('p1') });
  history.pushState(null, '', '/galeria?imagem=i1&post=p1');
  render(<Galeria />);
  await screen.findByText('Imagem 1 de 2');
  fireEvent.keyDown(screen.getByRole('dialog', { name: 'Detalhe do prompt' }), { key: 'ArrowRight' });
  expect(await screen.findByText('segundo prompt')).toBeTruthy();
  expect(screen.getByText('Imagem 2 de 2')).toBeTruthy();
});

test('filtro por clube refaz a busca com ?clube=', async () => {
  const chamadas = fetchFalso({
    'GET /galeria': { itens: [item('i1')], proximo: null },
    'GET /galeria?clube=palmeiras': { itens: [], proximo: null },
    'GET /clubes': [{ ...clube, tecnico: null }, { id: 'remo', nome: 'Remo', escudoUrl: '/escudos/remo.svg', tecnico: null }],
  });
  render(<Galeria />);
  await screen.findByRole('link', { name: /Prompt de Palmeiras/ });
  fireEvent.click(screen.getByRole('button', { name: /Todos os clubes/ }));
  fireEvent.click(await screen.findByRole('radio', { name: 'Palmeiras' }));
  expect(await screen.findByText('Ainda sem prompts do Palmeiras')).toBeTruthy();
  expect(chamadas.map((c) => c.chave)).toContain('GET /galeria?clube=palmeiras');
  fireEvent.click(screen.getByRole('button', { name: 'Limpar filtro' }));
  await waitFor(() => expect(screen.getByRole('link', { name: /Prompt de Palmeiras/ })).toBeTruthy());
});

test('fechar o detalhe vindo do feed volta ao feed', async () => {
  fetchFalso({ 'GET /galeria': { itens: [], proximo: null }, 'GET /posts/p1': postDe('p1') });
  history.pushState(null, '', '/');
  history.pushState(null, '', '/galeria?imagem=i1&post=p1');
  render(<Galeria />);
  fireEvent.click(await screen.findByRole('button', { name: 'Fechar' }));
  await waitFor(() => expect(location.pathname).toBe('/'));
});
