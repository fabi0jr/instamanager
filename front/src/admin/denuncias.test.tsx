import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type { Me } from '../api/cliente';
import { fetchFalso } from '../testes/fetchFalso';
import { Admin } from './Admin';

const admin: Me = { id: 'a', nome: 'Adm', email: 'a@x.com', avatarUrl: null, isAdmin: true, pushEnabled: false, clube: null };
const den = (id: string, extra = {}) => ({ id, criadoEm: new Date().toISOString(), motivo: null, resolvidaEm: null, denunciante: { id: 'u' + id, nome: 'Erik' + id }, post: null, comentario: null, ...extra });
const doPost = (id: string, pid = 'p1') => den(id, { post: { id: pid, legenda: 'Legenda do post', texto: null, clubeId: 'palmeiras' } });
const doComentario = (id: string) => den(id, { motivo: 'ofensivo', comentario: { id: 'c1', texto: 'Comentário feio', postId: 'p9' } });
const pagina = (itens: unknown[], proximo: string | null = null) => ({ itens, proximo });

beforeEach(() => vi.stubGlobal('IntersectionObserver', class { observe() {} disconnect() {} unobserve() {} }));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

test('início do admin: linha Denúncias com selo de contagem', async () => {
  fetchFalso({ 'GET /admin/trocas?status=PENDENTE': [], 'GET /admin/denuncias?abertas=1': pagina([doPost('1'), doComentario('2')]), 'GET /admin/convite': { codigo: 'X' }, 'GET /clubes': [] });
  render(<Admin me={admin} caminho="/admin" />);
  const link = await screen.findByRole('link', { name: /Denúncias/ });
  expect(link.getAttribute('href')).toBe('/admin/denuncias');
  expect(await within(link).findByLabelText('2 denúncias abertas')).toBeTruthy();
});

test('lista agrupa denúncias do mesmo item, mostra motivo/sem motivo e abre o post', async () => {
  fetchFalso({ 'GET /admin/denuncias?abertas=1': pagina([doPost('1'), doPost('2'), doComentario('3')]) });
  render(<Admin me={admin} caminho="/admin/denuncias" />);
  expect(await screen.findByText('2 denúncias')).toBeTruthy();
  expect(screen.getAllByRole('listitem')).toHaveLength(2);
  expect(screen.getAllByText(/Sem motivo/)).toHaveLength(2);
  expect(screen.getByText(/Motivo: ofensivo/)).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Legenda do post' }).getAttribute('href')).toBe('/p/p1');
  expect(screen.getByRole('link', { name: 'Comentário feio' }).getAttribute('href')).toBe('/p/p9');
});

test('Ocultar: oculta o post E resolve todas as denúncias do cartão; o cartão some com aviso', async () => {
  const chamadas = fetchFalso({
    'GET /admin/denuncias?abertas=1': pagina([doPost('1'), doPost('2')]),
    'PUT /admin/posts/p1/ocultar': { status: 204 },
    'POST /admin/denuncias/1/resolver': { status: 204 },
    'POST /admin/denuncias/2/resolver': { status: 204 },
  });
  render(<Admin me={admin} caminho="/admin/denuncias" />);
  fireEvent.click(await screen.findByRole('button', { name: 'Ocultar' }));
  expect(await screen.findByText('Post oculto.')).toBeTruthy();
  expect(chamadas.map((c) => c.chave).sort()).toEqual(['GET /admin/denuncias?abertas=1', 'POST /admin/denuncias/1/resolver', 'POST /admin/denuncias/2/resolver', 'PUT /admin/posts/p1/ocultar']);
  expect(screen.getByText('Sem denúncias abertas')).toBeTruthy();
});

test('Apagar pede confirmação e depois apaga o post e resolve; comentário usa /comentarios/:id', async () => {
  const chamadas = fetchFalso({
    'GET /admin/denuncias?abertas=1': pagina([doComentario('3')]),
    'DELETE /comentarios/c1': { status: 204 },
    'POST /admin/denuncias/3/resolver': { status: 204 },
  });
  render(<Admin me={admin} caminho="/admin/denuncias" />);
  fireEvent.click(await screen.findByRole('button', { name: 'Apagar' }));
  expect(chamadas.map((c) => c.chave)).toEqual(['GET /admin/denuncias?abertas=1']); // ainda não apagou
  fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Apagar' }));
  expect(await screen.findByText('Comentário apagado.')).toBeTruthy();
  expect(chamadas.map((c) => c.chave)).toEqual(expect.arrayContaining(['DELETE /comentarios/c1', 'POST /admin/denuncias/3/resolver']));
});

test('Ignorar só resolve (não oculta nem apaga)', async () => {
  const chamadas = fetchFalso({ 'GET /admin/denuncias?abertas=1': pagina([doPost('1')]), 'POST /admin/denuncias/1/resolver': { status: 204 } });
  render(<Admin me={admin} caminho="/admin/denuncias" />);
  fireEvent.click(await screen.findByRole('button', { name: 'Ignorar' }));
  expect(await screen.findByText('Denúncia ignorada.')).toBeTruthy();
  expect(chamadas.map((c) => c.chave)).toEqual(['GET /admin/denuncias?abertas=1', 'POST /admin/denuncias/1/resolver']);
});

test('falha ao agir mantém o cartão e avisa; vazio e erro de carga', async () => {
  fetchFalso({ 'GET /admin/denuncias?abertas=1': pagina([doPost('1')]), 'POST /admin/denuncias/1/resolver': { status: 500 } });
  render(<Admin me={admin} caminho="/admin/denuncias" />);
  fireEvent.click(await screen.findByRole('button', { name: 'Ignorar' }));
  expect(await screen.findByText(/Não deu para completar/)).toBeTruthy();
  expect(screen.getAllByRole('listitem')).toHaveLength(1);
  cleanup();
  fetchFalso({ 'GET /admin/denuncias?abertas=1': { status: 500 } });
  render(<Admin me={admin} caminho="/admin/denuncias" />);
  expect(await screen.findByRole('button', { name: 'Tentar de novo' })).toBeTruthy();
  void waitFor;
});

test('paginação por cursor (?antes=) vindo do back', async () => {
  const chamadas = fetchFalso({
    'GET /admin/denuncias?abertas=1': pagina([doPost('1')], 'cur1'),
    'GET /admin/denuncias?antes=cur1&abertas=1': pagina([doComentario('3')]),
  });
  const obs: { cb: IntersectionObserverCallback }[] = [];
  vi.stubGlobal('IntersectionObserver', class { constructor(public cb: IntersectionObserverCallback) { obs.push(this); } observe() {} disconnect() {} unobserve() {} });
  render(<Admin me={admin} caminho="/admin/denuncias" />);
  await screen.findByText(/Legenda do post/);
  await waitFor(() => expect(obs.length).toBeGreaterThan(0));
  obs.forEach((o) => o.cb([{ isIntersecting: true }] as IntersectionObserverEntry[], o as never));
  expect(await screen.findByText('Comentário feio')).toBeTruthy();
  expect(chamadas.map((c) => c.chave)).toContain('GET /admin/denuncias?antes=cur1&abertas=1');
});

test('Apagar post: o back apaga as denúncias em cascata, então o 404 do resolver conta como sucesso', async () => {
  const chamadas = fetchFalso({
    'GET /admin/denuncias?abertas=1': pagina([doPost('1'), doPost('2')]),
    'DELETE /posts/p1': { status: 204 },
    'POST /admin/denuncias/1/resolver': { status: 404, corpo: { codigo: 'NAO_ENCONTRADO', mensagem: 'x' } },
    'POST /admin/denuncias/2/resolver': { status: 404, corpo: { codigo: 'NAO_ENCONTRADO', mensagem: 'x' } },
  });
  render(<Admin me={admin} caminho="/admin/denuncias" />);
  fireEvent.click(await screen.findByRole('button', { name: 'Apagar' }));
  fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Apagar' }));
  expect(await screen.findByText('Post apagado.')).toBeTruthy();
  expect(screen.getByText('Sem denúncias abertas')).toBeTruthy();
  expect(chamadas.map((c) => c.chave)).toContain('DELETE /posts/p1');
});

test('um erro que não é 404 no resolver continua sendo falha', async () => {
  fetchFalso({ 'GET /admin/denuncias?abertas=1': pagina([doPost('1')]), 'DELETE /posts/p1': { status: 204 }, 'POST /admin/denuncias/1/resolver': { status: 500 } });
  render(<Admin me={admin} caminho="/admin/denuncias" />);
  fireEvent.click(await screen.findByRole('button', { name: 'Apagar' }));
  fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Apagar' }));
  expect(await screen.findByText(/Não deu para completar/)).toBeTruthy();
});
