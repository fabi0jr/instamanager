import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { VideoCard } from './VideoCard';
import type { Post } from './tipos';

const clube = { id: 'c', nome: 'Palmeiras', escudoUrl: '/e.svg' };
const post = (id: string): Post => ({ id, clube, autor: { id: 'u', nome: 'L' }, legenda: '', criadoEm: '', imagens: [], video: { url: `/${id}.mp4`, capaUrl: `/${id}.jpg`, duracaoS: 10, largura: 720, altura: 1280 }, curtidas: 0, curtiu: false, comentarios: 0, podeEditar: false });

// IntersectionObserver simulado: o teste dispara a razão de cada cartão
const obs: { alvo: Element; cb: IntersectionObserverCallback }[] = [];
const ver = (i: number, ratio: number) =>
  act(() => obs[i].cb([{ target: obs[i].alvo, isIntersecting: ratio > 0, intersectionRatio: ratio } as IntersectionObserverEntry], {} as IntersectionObserver));
const play = vi.fn(async () => {});
const pause = vi.fn();

beforeEach(() => {
  obs.length = 0;
  vi.stubGlobal('IntersectionObserver', class { cb: IntersectionObserverCallback; constructor(cb: IntersectionObserverCallback) { this.cb = cb; } observe(alvo: Element) { obs.push({ alvo, cb: this.cb }); } disconnect() {} unobserve() {} });
  play.mockClear(); pause.mockClear();
  Object.defineProperty(HTMLMediaElement.prototype, 'play', { configurable: true, value: play });
  Object.defineProperty(HTMLMediaElement.prototype, 'pause', { configurable: true, value: pause });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

test('antes de aparecer só a capa; com >= 60% monta o <video> mudo, em loop, e toca', () => {
  render(<VideoCard post={post('a')} />);
  expect(document.querySelector('video')).toBeNull();
  ver(0, 0.5);
  expect(document.querySelector('video')).toBeNull();
  ver(0, 0.6);
  const v = document.querySelector('video')!;
  expect(v.muted).toBe(true);
  expect(v.loop).toBe(true);
  expect(v.playsInline).toBe(true);
  expect(play).toHaveBeenCalled();
});

test('sair da tela pausa', () => {
  render(<VideoCard post={post('a')} />);
  ver(0, 0.9);
  pause.mockClear();
  ver(0, 0.1);
  expect(pause).toHaveBeenCalled();
});

test('só um vídeo por vez: toca o mais visível, e o outro assume quando ele sai', () => {
  render(<><VideoCard post={post('a')} /><VideoCard post={post('b')} /></>);
  ver(0, 0.7);
  ver(1, 0.9);
  const videos = () => [...document.querySelectorAll('video')];
  expect(videos().map((x) => x.getAttribute('src'))).toContain('/b.mp4');
  pause.mockClear(); play.mockClear();
  ver(1, 0.1); // b sai: a (0.7) volta a ser a mais visível
  expect(play).toHaveBeenCalled();
  expect(pause).toHaveBeenCalled();
});

test('se a pessoa pausou, fica pausado até sair e voltar', () => {
  render(<VideoCard post={post('a')} />);
  ver(0, 0.9);
  const v = document.querySelector('video')!;
  Object.defineProperty(v, 'paused', { configurable: true, value: false });
  fireEvent.click(v); // pausa pelo usuário
  expect(pause).toHaveBeenCalled();
  play.mockClear();
  ver(0, 0.95); // continua visível: não retoma
  expect(play).not.toHaveBeenCalled();
  ver(0, 0); // sai
  ver(0, 0.8); // volta
  expect(play).toHaveBeenCalled();
});

test('autoplay barrado: cai no botão de play, sem mensagem de erro', async () => {
  play.mockRejectedValueOnce(new Error('NotAllowedError'));
  render(<VideoCard post={post('a')} />);
  ver(0, 0.9);
  await act(async () => {});
  expect(screen.getByRole('button', { name: 'Tocar vídeo' })).toBeTruthy();
  expect(screen.queryByText(/Não deu para tocar/)).toBeNull();
});

test('saveData ou movimento reduzido: continua capa + play, sem autoplay', () => {
  vi.stubGlobal('navigator', Object.assign(Object.create(navigator), { connection: { saveData: true } }));
  render(<VideoCard post={post('a')} />);
  ver(0, 1);
  expect(document.querySelector('video')).toBeNull();
  expect(screen.getByRole('button', { name: 'Tocar vídeo' })).toBeTruthy();
  cleanup();
  vi.unstubAllGlobals();
  vi.stubGlobal('IntersectionObserver', class { cb: IntersectionObserverCallback; constructor(cb: IntersectionObserverCallback) { this.cb = cb; } observe(alvo: Element) { obs.push({ alvo, cb: this.cb }); } disconnect() {} unobserve() {} });
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduce'), media: q }));
  obs.length = 0;
  render(<VideoCard post={post('a')} />);
  ver(0, 1);
  expect(document.querySelector('video')).toBeNull();
});

test('play manual no cartão de baixo vira o ativo (o outro pausa e volta à capa) e rolar para longe pausa', () => {
  render(<><VideoCard post={post('a')} /><VideoCard post={post('b')} /></>);
  ver(0, 0.9);
  ver(1, 0.4); // b aparece pouco: não é o mais visível
  expect(document.querySelectorAll('video')).toHaveLength(1);
  pause.mockClear();
  fireEvent.click(screen.getAllByRole('button', { name: 'Tocar vídeo' })[1]);
  expect([...document.querySelectorAll('video')].map((x) => x.getAttribute('src'))).toEqual(['/b.mp4']); // só um toca
  expect(pause).toHaveBeenCalled();
  pause.mockClear();
  ver(1, 0.05); // rolou para longe
  expect(document.querySelector('video[src="/b.mp4"]')).toBeNull(); // desmontou, voltou à capa
  expect(pause).toHaveBeenCalled();
});

test('sair da tela zera o som: ao voltar toca mudo; som ligado na capa também zera', () => {
  render(<VideoCard post={post('a')} />);
  ver(0, 0.9);
  fireEvent.click(screen.getByRole('button', { name: 'Ligar o som' }));
  expect(document.querySelector('video')!.muted).toBe(false);
  ver(0, 0.1);
  ver(0, 0.9);
  expect(document.querySelector('video')!.muted).toBe(true);
  ver(0, 0.1);
  fireEvent.click(screen.getByRole('button', { name: 'Ligar o som' })); // na capa
  ver(0, 0.05); // continua fora: sair de novo zera
  expect(screen.getByRole('button', { name: 'Ligar o som' })).toBeTruthy();
});

const semAuto = () => vi.stubGlobal('navigator', Object.assign(Object.create(navigator), { connection: { saveData: true } }));

test('saveData: um toque em play monta o vídeo e chama play uma vez', () => {
  semAuto();
  render(<VideoCard post={post('a')} />);
  ver(0, 1); // já é o mais visível (ativo), mas sem autoplay
  expect(document.querySelector('video')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Tocar vídeo' }));
  expect(document.querySelector('video')).not.toBeNull();
  expect(play).toHaveBeenCalledTimes(1);
});

test('falha ao tocar: "toque para tentar de novo" chama play com um toque', async () => {
  semAuto();
  play.mockRejectedValueOnce(new Error('x'));
  render(<VideoCard post={post('a')} />);
  ver(0, 1);
  fireEvent.click(screen.getByRole('button', { name: 'Tocar vídeo' }));
  await act(async () => {});
  const tentar = screen.getByRole('button', { name: /Não deu para tocar/ });
  play.mockClear();
  fireEvent.click(tentar);
  expect(play).toHaveBeenCalledTimes(1);
  expect(screen.queryByText(/Não deu para tocar/)).toBeNull();
});

test('pausar o vídeo tocado à mão solta a vez: o mais visível volta a tocar', () => {
  render(<><VideoCard post={post('a')} /><VideoCard post={post('b')} /></>);
  ver(0, 0.9);
  ver(1, 0.4);
  fireEvent.click(screen.getAllByRole('button', { name: 'Tocar vídeo' })[1]);
  expect([...document.querySelectorAll('video')].map((x) => x.getAttribute('src'))).toEqual(['/b.mp4']);
  const b = document.querySelector('video')!;
  Object.defineProperty(b, 'paused', { configurable: true, value: false });
  fireEvent.click(b); // pausa
  expect([...document.querySelectorAll('video')].map((x) => x.getAttribute('src'))).toEqual(['/a.mp4']);
});

test('som ligado na capa só vale se o vídeo começar pelo toque em play, não ao chegar a 60%', () => {
  render(<VideoCard post={post('a')} />);
  ver(0, 0.3);
  fireEvent.click(screen.getByRole('button', { name: 'Ligar o som' }));
  ver(0, 0.9); // começou sozinho
  expect(document.querySelector('video')!.muted).toBe(true);
  ver(0, 0.05);
  fireEvent.click(screen.getByRole('button', { name: 'Ligar o som' }));
  fireEvent.click(screen.getByRole('button', { name: 'Tocar vídeo' })); // começou pelo toque
  expect(document.querySelector('video')!.muted).toBe(false);
});

test('o aviso de falha some ao perder a vez: ao voltar não toca com "Não deu para tocar" por cima', async () => {
  semAuto();
  play.mockRejectedValueOnce(new Error('x'));
  render(<VideoCard post={post('a')} />);
  ver(0, 1);
  fireEvent.click(screen.getByRole('button', { name: 'Tocar vídeo' }));
  await act(async () => {});
  expect(screen.getByRole('button', { name: /Não deu para tocar/ })).toBeTruthy();
  ver(0, 0.05); // saiu
  expect(screen.queryByText(/Não deu para tocar/)).toBeNull();
  ver(0, 1); // voltou
  expect(screen.queryByText(/Não deu para tocar/)).toBeNull();
});
