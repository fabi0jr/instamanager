import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type { Me } from '../api/cliente';
import { fetchFalso } from '../testes/fetchFalso';
import { FaixaStories, ordenar } from './Faixa';
import { Visualizador } from './Visualizador';
import type { FaixaClube } from './tipos';

const clube = (id: string, nome = id) => ({ id, nome, escudoUrl: `/escudos/${id}.svg` });
const story = (id: string, extra: object = {}) => ({ id, tipo: 'IMAGEM', url: `/uploads/${id}.jpg`, capaUrl: null, criadoEm: '2026-11-04T10:00:00Z', visto: false, ...extra });
const faixa = (id: string, stories: object[], todosVistos = false): FaixaClube => ({ clube: clube(id), stories: stories as FaixaClube['stories'], todosVistos });
const me: Me = { id: 'u1', nome: 'Lincoln', email: 'l@x.com', avatarUrl: null, isAdmin: false, pushEnabled: false, clube: clube('santos') };

beforeEach(() => { history.replaceState(null, '', '/stories/vasco'); });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

test('faixa mostra clubes com stories e os não vistos primeiro (Seu story, CBF, novos, vistos)', async () => {
  const lista = [
    faixa('vasco', [story('a', { criadoEm: '2026-11-04T09:00:00Z' })], true),
    faixa('cbf', [story('b')]),
    faixa('palmeiras', [story('c', { criadoEm: '2026-11-04T08:00:00Z' })]),
    faixa('flamengo', [story('d', { criadoEm: '2026-11-04T11:00:00Z' })]),
    faixa('santos', [story('e')], true),
  ];
  expect(ordenar(lista, 'santos').map((f) => f.clube.id)).toEqual(['santos', 'cbf', 'flamengo', 'palmeiras', 'vasco']);
  fetchFalso({ 'GET /stories': lista });
  render(<FaixaStories me={me} />);
  const links = await screen.findAllByRole('link');
  // o + do "Seu story" é um link à parte (criar); a bolinha abre o visualizador
  expect(links.map((a) => a.getAttribute('href'))).toEqual(['/stories/novo', '/stories/santos', '/stories/cbf', '/stories/flamengo', '/stories/palmeiras', '/stories/vasco']);
  expect(links[0].getAttribute('aria-label')).toBe('Novo story');
  expect(links[1].getAttribute('aria-label')).toBe('Seu story, já visto');
  expect(document.querySelectorAll('.anel.visto')).toHaveLength(2);
});

test('técnico sem story ativo vê "Seu story" com + que leva a /stories/novo; sem stories e sem clube a faixa some', async () => {
  fetchFalso({ 'GET /stories': [faixa('vasco', [story('a')])] });
  render(<FaixaStories me={me} />);
  expect((await screen.findByRole('link', { name: 'Criar story' })).getAttribute('href')).toBe('/stories/novo');
  cleanup();
  fetchFalso({ 'GET /stories': [] });
  const { container } = render(<FaixaStories me={{ ...me, clube: null }} />);
  await waitFor(() => expect(container.querySelector('.esqueleto')).toBeNull());
  expect(container.querySelector('.faixa-stories')).toBeNull();
});

const abrir = async (lista: FaixaClube[], quem: Me = me, id = 'vasco') => {
  const chamadas = fetchFalso({ 'GET /stories': lista, 'PUT /stories/a/visto': { status: 204 }, 'PUT /stories/b/visto': { status: 204 }, 'PUT /stories/c/visto': { status: 204 }, 'GET /stories/a/vistos': [{ id: 'x', nome: 'Rita' }, { id: 'y', nome: 'Paulo' }], 'DELETE /stories/a': { status: 204 } });
  render(<Visualizador clubeId={id} me={quem} />);
  await screen.findByRole('dialog');
  return chamadas;
};

test('visualizador: imagem avança em 5 s, marca visto e fecha no último', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  history.pushState(null, '', '/stories/vasco');
  const chamadas = await abrir([faixa('vasco', [story('a'), story('b')])]);
  await waitFor(() => expect(chamadas.some((c) => c.chave === 'PUT /stories/a/visto')).toBe(true));
  expect(document.querySelectorAll('.vis-barras i')).toHaveLength(2);
  await act(async () => { vi.advanceTimersByTime(5200); });
  await waitFor(() => expect(chamadas.some((c) => c.chave === 'PUT /stories/b/visto')).toBe(true)); // foi para o 2º
  expect(document.querySelector<HTMLImageElement>('.midia')!.src).toContain('/uploads/b.jpg');
});

test('tocar avança (terço direito) e volta (esquerdo); segurar pausa; Esc fecha', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  history.pushState(null, '', '/');
  history.pushState(null, '', '/stories/vasco');
  await abrir([faixa('vasco', [story('a'), story('b'), story('c')])]);
  const tela = screen.getByRole('dialog');
  tela.getBoundingClientRect = () => ({ left: 0, width: 300, top: 0, height: 600, right: 300, bottom: 600, x: 0, y: 0, toJSON() {} });
  const img = () => document.querySelector<HTMLImageElement>('.midia')!.src;
  fireEvent.click(tela, { clientX: 250 });
  await waitFor(() => expect(img()).toContain('/b.jpg'));
  fireEvent.click(tela, { clientX: 20 });
  await waitFor(() => expect(img()).toContain('/a.jpg'));
  // segurar: pausa o relógio (passam 5 s e continua no mesmo story)
  fireEvent.pointerDown(tela, { clientX: 150, clientY: 100 });
  await act(async () => { vi.advanceTimersByTime(300); });
  expect(tela.className).toContain('pausado');
  await act(async () => { vi.advanceTimersByTime(6000); });
  expect(img()).toContain('/a.jpg');
  fireEvent.pointerUp(tela);
  fireEvent.keyDown(document, { key: 'Escape' });
  await waitFor(() => expect(location.pathname).toBe('/'));
});

test('autor vê "Visto por N", abre a lista e apaga com confirmação', async () => {
  const chamadas = await abrir([faixa('santos', [story('a')])], me, 'santos');
  fireEvent.click(await screen.findByRole('button', { name: /Visto por 2/ }));
  expect(await screen.findByText('Rita')).toBeTruthy();
  fireEvent.click(screen.getAllByRole('button', { name: 'Fechar' }).at(-1)!);
  fireEvent.click(screen.getByRole('button', { name: 'Apagar story' }));
  expect(screen.getByRole('alertdialog').textContent).toContain('Apagar este story?');
  fireEvent.click(screen.getByRole('button', { name: 'Apagar' }));
  await waitFor(() => expect(chamadas.some((c) => c.chave === 'DELETE /stories/a')).toBe(true));
});

test('quem não é o autor não vê "Visto por"; story fora do ar mostra "Esse story já saiu do ar"', async () => {
  await abrir([faixa('vasco', [story('a')])]);
  expect(screen.queryByRole('button', { name: /Visto por/ })).toBeNull();
  cleanup();
  fetchFalso({ 'GET /stories': [] });
  render(<Visualizador clubeId="vasco" me={me} />);
  expect(await screen.findByText('Esse story já saiu do ar')).toBeTruthy();
});

test('vídeo começa mudo, com dica e botão de som', async () => {
  await abrir([faixa('vasco', [story('a', { tipo: 'VIDEO', capaUrl: '/c.jpg' })])]);
  const v = document.querySelector('video')!;
  expect(v.muted).toBe(true);
  expect(v.hasAttribute('playsinline') || (v as HTMLVideoElement & { playsInline: boolean }).playsInline).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Ligar o som' }));
  expect(document.querySelector('video')!.muted).toBe(false);
  expect(screen.getByRole('button', { name: 'Desligar o som' })).toBeTruthy();
});

test('tocar no véu da folha "Visto por" ou do diálogo não avança o story (eventos de portal)', async () => {
  const chamadas = await abrir([faixa('santos', [story('a'), story('b')])], me, 'santos');
  const img = () => document.querySelector<HTMLImageElement>('.midia')!.src;
  fireEvent.click(await screen.findByRole('button', { name: /Visto por 2/ }));
  const veu = document.body.querySelector<HTMLElement>('body > .veu')!;
  fireEvent.pointerDown(veu, { clientX: 300, clientY: 100 });
  fireEvent.click(veu, { clientX: 300 }); // clique no véu fecha a folha, mas não é toque no story
  await waitFor(() => expect(screen.queryByRole('dialog', { name: /Visto por/ })).toBeNull());
  expect(img()).toContain('/a.jpg');
  expect(chamadas.some((c) => c.chave === 'PUT /stories/b/visto')).toBe(false);
  fireEvent.click(screen.getByRole('button', { name: 'Apagar story' }));
  fireEvent.click(document.body.querySelector<HTMLElement>('body > .veu')!, { clientX: 300 });
  await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
  expect(img()).toContain('/a.jpg');
});

test('admin sem clube vê "Story da CBF" na faixa (cria como CBF); com story da CBF a bolinha ganha o +', async () => {
  const adm: Me = { ...me, clube: null, isAdmin: true };
  fetchFalso({ 'GET /stories': [] });
  render(<FaixaStories me={adm} />);
  const criar = await screen.findByRole('link', { name: 'Criar story da CBF' });
  expect(criar.getAttribute('href')).toBe('/stories/novo?cbf=1');
  cleanup();
  fetchFalso({ 'GET /stories': [faixa('cbf', [story('b')])] });
  render(<FaixaStories me={adm} />);
  expect((await screen.findByRole('link', { name: 'Novo story da CBF' })).getAttribute('href')).toBe('/stories/novo?cbf=1');
  expect(screen.getByRole('link', { name: /Story de cbf/ }).getAttribute('href')).toBe('/stories/cbf');
});

test('torcedor sem story na faixa não vê nenhuma entrada de criar', async () => {
  fetchFalso({ 'GET /stories': [faixa('vasco', [story('a')])] });
  render(<FaixaStories me={{ ...me, clube: null }} />);
  await screen.findByRole('link', { name: /Story de vasco/ });
  expect(screen.queryByRole('link', { name: /Novo story|Criar story/ })).toBeNull();
});
