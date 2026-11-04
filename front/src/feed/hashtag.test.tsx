import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { fetchFalso } from '../testes/fetchFalso';
import { Tag } from '../tag/Tag';
import { Texto } from './Texto';

beforeEach(() => vi.stubGlobal('IntersectionObserver', class { observe() {} disconnect() {} unobserve() {} }));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const links = (c: HTMLElement) => [...c.querySelectorAll('a')].map((a) => [a.textContent, a.getAttribute('href')]);

test('#Contratação vira link para /tag/contratacao (sem acento/maiúscula)', () => {
  const { container } = render(<Texto>{'Chegou o #Contratação do ano, #bora!'}</Texto>);
  expect(links(container)).toEqual([['#Contratação', '/tag/contratacao'], ['#bora', '/tag/bora']]);
  expect(container.textContent).toBe('Chegou o #Contratação do ano, #bora!');
});

test('não vira link: # sozinho, ## , número puro, # em URL ou colado em palavra', () => {
  const { container } = render(<Texto>{'# sozinho ## dupla #123 veja site.com/#x e https://a.com/p#y ou a#b e (#ok)'}</Texto>);
  expect(links(container)).toEqual([['#ok', '/tag/ok']]);
});

test('/tag/:tag lista com rolagem infinita, inclusive post de texto', async () => {
  const post = (id: string, extra = {}) => ({ id, clube: { id: 'p', nome: 'Palmeiras', escudoUrl: '/e.svg' }, autor: { id: 'u', nome: 'Abel' }, legenda: '', texto: null, imagens: [{ id: id + 'i', miniUrl: `/${id}.jpg`, cheiaUrl: '', largura: 1, altura: 1, prompt: null }], ...extra });
  const chamadas = fetchFalso({
    'GET /posts?tag=contratacao': { itens: [post('a'), post('t', { imagens: [], texto: 'Contratação #contratacao' })], proximo: 'c1' },
    'GET /posts?antes=c1&tag=contratacao': { itens: [post('b')], proximo: null },
  });
  const { container } = render(<Tag tag="contratacao" />);
  expect(screen.getByRole('heading', { name: '#contratacao' })).toBeTruthy();
  expect(await screen.findByRole('link', { name: 'Post de texto de Abel, Palmeiras' })).toBeTruthy();
  expect(container.querySelectorAll('.grade-capas img')).toHaveLength(1);
  expect(chamadas[0].chave).toBe('GET /posts?tag=contratacao');
});

test('/tag/:tag vazia e com erro', async () => {
  fetchFalso({ 'GET /posts?tag=nada': { itens: [], proximo: null } });
  render(<Tag tag="nada" />);
  expect(await screen.findByText('Nenhum post com #nada ainda.')).toBeTruthy();
  cleanup();
  fetchFalso({ 'GET /posts?tag=x': { status: 500 } });
  render(<Tag tag="x" />);
  expect(await screen.findByRole('button', { name: 'Tentar de novo' })).toBeTruthy();
  void waitFor;
});
