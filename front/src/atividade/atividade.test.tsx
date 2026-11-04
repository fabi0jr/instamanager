import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { BarraInferior } from '../BarraInferior';
import { fetchFalso } from '../testes/fetchFalso';
import { Atividade } from './Atividade';

const ator = (nome: string) => ({ id: 'u-' + nome, nome, avatarUrl: null });
const item = (id: string, tipo: string, extra: object = {}) => ({ id, tipo, criadoEm: new Date().toISOString(), lida: true, ator: ator('Paulo'), post: { id: 'p' + id, miniUrl: `/m${id}.jpg`, resumo: 'Treino de hoje' }, votacao: null, ...extra });

beforeEach(() => vi.stubGlobal('IntersectionObserver', class { observe() {} disconnect() {} unobserve() {} }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

test('Atividade lista e marca lidas ao abrir; as novas ficam destacadas nesta visita', async () => {
  const chamadas = fetchFalso({
    'GET /atividade': { itens: [item('1', 'REACAO', { lida: false }), item('2', 'COMENTARIO'), item('3', 'MENCAO', { lida: false }), item('4', 'CBF_CITOU', { ator: null }), item('5', 'VOTACAO_RESULTADO', { ator: null, votacao: { id: 'v1', titulo: 'Técnico do mês' } })], proximo: null },
    'POST /atividade/lidas': { status: 204 },
  });
  render(<Atividade />);
  expect(await screen.findByText('Novas')).toBeTruthy();
  expect(screen.getByText('Mais antigas')).toBeTruthy();
  await waitFor(() => expect(chamadas.some((c) => c.chave === 'POST /atividade/lidas')).toBe(true));
  expect(document.querySelectorAll('.item-ativ.nova')).toHaveLength(2); // continuam destacadas depois de marcar lidas
  expect(screen.getByText(/comentou: “Treino de hoje”/)).toBeTruthy();
  expect(screen.getByText(/mencionou você: “Treino de hoje”/)).toBeTruthy();
  expect(screen.getByText(/CBF citou você no comunicado/)).toBeTruthy();
  expect(screen.getByText(/Resultado de Técnico do mês/)).toBeTruthy();
  expect(document.querySelector('a[href="/votacoes/v1"]')).toBeTruthy();
  expect(document.querySelector('a[href="/p/p1"]')).toBeTruthy();
});

test('item de post indisponível fica sem legenda, sem link e com a data "Post indisponível"', async () => {
  fetchFalso({ 'GET /atividade': { itens: [item('1', 'COMENTARIO', { ator: ator('Dani'), post: { id: 'px', miniUrl: null, resumo: 'Post indisponível' } })], proximo: null }, 'POST /atividade/lidas': { status: 204 } });
  render(<Atividade />);
  expect(await screen.findByText(/Dani/)).toBeTruthy();
  expect(screen.getByText(/comentou em um post/)).toBeTruthy();
  expect(screen.queryByText(/Post indisponível ·/)).not.toBeNull();
  expect(document.querySelector('a[href="/p/px"]')).toBeNull();
});

test('vazio e erro', async () => {
  fetchFalso({ 'GET /atividade': { itens: [], proximo: null } });
  render(<Atividade />);
  expect(await screen.findByText('Nada por aqui ainda')).toBeTruthy();
  cleanup();
  fetchFalso({ 'GET /atividade': { status: 500, corpo: {} } });
  render(<Atividade />);
  expect(await screen.findByText('Não deu para carregar a atividade')).toBeTruthy();
});

test('contador da barra: nenhum, número e 9+; zera ao abrir /atividade', async () => {
  for (const [total, texto] of [[0, null], [3, '3'], [14, '9+']] as const) {
    cleanup();
    history.pushState(null, '', '/');
    fetchFalso({ 'GET /atividade/nao-lidas': { total } });
    render(<BarraInferior />);
    await waitFor(() => expect(document.querySelector('.contador')?.textContent ?? null).toBe(texto));
    if (texto) expect(screen.getByRole('link', { name: `Atividade, ${total} não lidas` })).toBeTruthy();
  }
  history.pushState(null, '', '/atividade');
  cleanup();
  fetchFalso({ 'GET /atividade/nao-lidas': { total: 5 } });
  render(<BarraInferior />);
  expect(document.querySelector('.contador')).toBeNull();
});

test('troca decidida mostra aprovado/recusado quando o back manda o status; sem status, texto neutro', async () => {
  const troca = (status?: string) => item('t', 'TROCA_DECIDIDA', { ator: null, post: null, ...(status ? { troca: { status, clube: { id: 'vasco', nome: 'Vasco' } } } : {}) });
  fetchFalso({ 'GET /atividade': { itens: [troca('APROVADA'), { ...troca('RECUSADA'), id: 't2' }, { ...troca(), id: 't3' }], proximo: null }, 'POST /atividade/lidas': { status: 204 } });
  render(<Atividade />);
  expect(await screen.findByText('Seu pedido de troca foi aprovado.')).toBeTruthy();
  expect(screen.getByText('Seu pedido de troca foi recusado.')).toBeTruthy();
  expect(screen.getByText('Seu pedido de troca foi decidido.')).toBeTruthy();
  expect(document.querySelector('a[href="/c/vasco"]')).toBeTruthy();
});

test('troca decidida de pedido para sair (clube null) abre o Perfil', async () => {
  fetchFalso({ 'GET /atividade': { itens: [item('t', 'TROCA_DECIDIDA', { ator: null, post: null, troca: { status: 'APROVADA', clube: null } })], proximo: null }, 'POST /atividade/lidas': { status: 204 } });
  render(<Atividade />);
  expect(await screen.findByText('Seu pedido de troca foi aprovado.')).toBeTruthy();
  expect(document.querySelector('a[href="/perfil"]')).toBeTruthy();
});
