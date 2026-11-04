import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type { Me } from '../api/cliente';
import { fetchFalso } from '../testes/fetchFalso';
import { Postar } from '../postar/Postar';
import { CardPost } from './CardPost';
import type { Post } from './tipos';

vi.mock('../stories/tipos', async (o) => ({ ...(await o<typeof import('../stories/tipos')>()), duracaoDoArquivo: vi.fn(async () => 24) })); // jsdom não lê metadados de vídeo

const clube = { id: 'palmeiras', nome: 'Palmeiras', escudoUrl: '/escudos/palmeiras.svg' };
const me: Me = { id: 'u1', nome: 'Lincoln', email: 'l@x.com', avatarUrl: null, isAdmin: false, pushEnabled: false, clube };
const post: Post = { id: 'p1', clube, autor: { id: 'u1', nome: 'Lincoln' }, legenda: 'Gol', criadoEm: new Date().toISOString(), imagens: [], video: { url: '/uploads/v.mp4', capaUrl: '/uploads/v.jpg', duracaoS: 24, largura: 720, altura: 1280 }, curtidas: 0, curtiu: false, comentarios: 0, podeEditar: false };

beforeEach(() => {
  vi.stubGlobal('IntersectionObserver', class { observe() {} disconnect() {} unobserve() {} });
  Object.defineProperty(HTMLMediaElement.prototype, 'play', { configurable: true, value: vi.fn(async () => {}) });
  Object.defineProperty(HTMLMediaElement.prototype, 'pause', { configurable: true, value: vi.fn() });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); localStorage.clear(); });

test('card de vídeo usa a capa, sem <video> nem autoplay até o toque; depois toca mudo e playsInline', () => {
  fetchFalso({});
  render(<CardPost post={post} me={me} />);
  expect(document.querySelector('video')).toBeNull(); // nada baixa nem toca antes do toque
  expect(document.querySelector<HTMLImageElement>('.video-card img')!.src).toContain('/uploads/v.jpg');
  expect(screen.getByText('0:24')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Tocar vídeo' }));
  const v = document.querySelector('video')!;
  expect(v.autoplay).toBe(false);
  expect(v.muted).toBe(true);
  expect(v.playsInline).toBe(true);
  expect(screen.getByRole('button', { name: 'Ligar o som' })).toBeTruthy();
});

test('postar com vídeo: aba Vídeo, aviso de 60 MB e envio do campo video + legenda', async () => {
  localStorage.setItem('im:postar-modo', 'video');
  const envios: FormData[] = [];
  class Xhr { upload = {}; status = 201; responseText = '{"id":"n"}'; onload?: () => void; open = vi.fn(); send(f: FormData) { envios.push(f); queueMicrotask(() => this.onload?.()); } }
  vi.stubGlobal('XMLHttpRequest', Xhr);
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:x'), revokeObjectURL: vi.fn() }));
  fetchFalso({});
  render(<Postar me={me} />);
  expect(screen.getAllByRole('radio').map((r) => r.textContent)).toEqual(['Foto', 'Texto', 'Vídeo']);
  const grande = new File(['x'], 'g.mp4', { type: 'video/mp4' });
  Object.defineProperty(grande, 'size', { value: 61 * 1024 * 1024 });
  fireEvent.change(screen.getByLabelText('Escolher vídeo'), { target: { files: [grande] } });
  expect(await screen.findByText('Esse arquivo passa de 60 MB')).toBeTruthy();
  expect((screen.getByRole('button', { name: 'Continuar' }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.change(screen.getByLabelText('Escolher vídeo'), { target: { files: [new File(['x'], 'v.mov', { type: 'video/quicktime' })] } });
  await screen.findByText(/converte ao publicar/);
  fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
  fireEvent.change(screen.getByLabelText('Legenda'), { target: { value: 'Gol!' } });
  fireEvent.click(screen.getByRole('button', { name: 'Publicar' }));
  await vi.waitFor(() => expect(envios).toHaveLength(1));
  expect((envios[0].get('video') as File).name).toBe('v.mov');
  expect(envios[0].get('legenda')).toBe('Gol!');
  expect(envios[0].getAll('cheia')).toHaveLength(0);
});

test('trocar de aba em /postar com conteúdo pede confirmação para descartar; sem conteúdo troca direto', async () => {
  localStorage.setItem('im:postar-modo', 'texto');
  fetchFalso({});
  render(<Postar me={me} />);
  fireEvent.click(screen.getByRole('radio', { name: 'Vídeo' })); // vazio: troca direto
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(screen.getByRole('radio', { name: 'Vídeo' }).getAttribute('aria-checked')).toBe('true');
  fireEvent.click(screen.getByRole('radio', { name: 'Texto' }));
  fireEvent.change(screen.getByPlaceholderText('O que está rolando?'), { target: { value: 'rascunho' } });
  fireEvent.click(screen.getByRole('radio', { name: 'Foto' }));
  expect(screen.getByRole('dialog', { name: 'Descartar este post?' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Continuar editando' }));
  expect((screen.getByPlaceholderText('O que está rolando?') as HTMLTextAreaElement).value).toBe('rascunho'); // continua na aba
  fireEvent.click(screen.getByRole('radio', { name: 'Foto' }));
  fireEvent.click(screen.getByRole('button', { name: 'Descartar' }));
  expect(screen.getByRole('radio', { name: 'Foto' }).getAttribute('aria-checked')).toBe('true');
  expect(screen.queryByPlaceholderText('O que está rolando?')).toBeNull();
});
