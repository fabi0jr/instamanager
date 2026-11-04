import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type { Me } from '../api/cliente';
import { CriarStory } from './CriarStory';

vi.mock('../postar/comprimir', async (o) => ({ ...(await o<typeof import('../postar/comprimir')>()), comprimir: vi.fn(async (a: File, lado: number) => ({ blob: new Blob([`${a.name}:${lado}`], { type: 'image/jpeg' }), largura: lado, altura: lado })) }));
vi.mock('./tipos', async (o) => ({ ...(await o<typeof import('./tipos')>()), duracaoDoArquivo: vi.fn(async (a: File) => (a.name.startsWith('longo') ? 31 : 18)) }));

const clube = { id: 'santos', nome: 'Santos', escudoUrl: '/escudos/santos.svg' };
const tecnico: Me = { id: 'u1', nome: 'Lincoln', email: 'l@x.com', avatarUrl: null, isAdmin: false, pushEnabled: false, clube };

let envios: FormData[] = [];
let resposta: { status: number; corpo: string; parar?: boolean } = { status: 201, corpo: '{"id":"s1"}' };
let ultimo: FakeXhr | null = null;
class FakeXhr {
  upload: { onprogress?: (e: unknown) => void } = {};
  status = 0; responseText = '';
  onload?: () => void; onerror?: () => void; onabort?: () => void;
  open = vi.fn();
  abort = vi.fn(() => this.onabort?.());
  send(form: FormData) {
    envios.push(form);
    ultimo = this;
    queueMicrotask(() => {
      this.upload.onprogress?.({ lengthComputable: true, loaded: 100, total: 100 });
      if (resposta.parar) return; // fica "convertendo" até a gente soltar
      this.status = resposta.status; this.responseText = resposta.corpo; this.onload?.();
    });
  }
}
beforeEach(() => {
  envios = []; resposta = { status: 201, corpo: '{"id":"s1"}' };
  vi.stubGlobal('XMLHttpRequest', FakeXhr);
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:x'), revokeObjectURL: vi.fn() }));
  history.replaceState(null, '', '/stories/novo');
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const arquivo = (nome: string, tipo: string, tamanho = 10) => { const f = new File(['x'], nome, { type: tipo }); Object.defineProperty(f, 'size', { value: tamanho }); return f; };
const escolher = (rotulo: string, f: File) => fireEvent.change(screen.getByLabelText(rotulo), { target: { files: [f] } });

test('criar story foto: comprime em 1600, mostra a prévia e envia o campo imagem', async () => {
  render(<CriarStory me={tecnico} />);
  escolher('Escolher foto', arquivo('a.jpg', 'image/jpeg'));
  fireEvent.click(await screen.findByRole('button', { name: 'Publicar story' }));
  await waitFor(() => expect(envios).toHaveLength(1));
  expect(await (envios[0].get('imagem') as Blob).text()).toBe('a.jpg:1600');
  expect(envios[0].get('video')).toBeNull();
  await waitFor(() => expect(location.pathname).toBe('/'));
});

test('criar story vídeo: envio com progresso e depois "Convertendo vídeo…"', async () => {
  resposta = { status: 201, corpo: '{}', parar: true };
  render(<CriarStory me={tecnico} />);
  escolher('Escolher vídeo', arquivo('v.mov', 'video/quicktime'));
  expect(await screen.findByText('0:18')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Publicar story' }));
  expect(await screen.findByText('Convertendo vídeo…')).toBeTruthy();
  expect(screen.getByText(/Leva até 1 minuto/)).toBeTruthy();
  expect(envios[0].get('video')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
  expect(ultimo!.abort).toHaveBeenCalled();
});

test('vídeo > 60 MB e > 30 s são avisados antes de enviar', async () => {
  render(<CriarStory me={tecnico} />);
  escolher('Escolher vídeo', arquivo('grande.mp4', 'video/mp4', 61 * 1024 * 1024));
  expect(await screen.findByText('Esse arquivo passa de 60 MB')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Escolher outro vídeo' }));
  escolher('Escolher vídeo', arquivo('longo.mp4', 'video/mp4'));
  expect(await screen.findByText('Esse vídeo tem 31 s')).toBeTruthy();
  expect(envios).toHaveLength(0);
});

test('VIDEO_LONGO, VIDEO_INVALIDO e 413 do servidor mostram a mensagem', async () => {
  for (const [status, codigo, texto] of [[400, 'VIDEO_LONGO', 'Esse vídeo é longo demais'], [422, 'VIDEO_INVALIDO', 'Não deu para ler esse vídeo'], [413, 'CORPO_GRANDE', 'Esse arquivo passa de 60 MB']] as const) {
    cleanup();
    resposta = { status, corpo: JSON.stringify({ codigo }) };
    render(<CriarStory me={tecnico} />);
    escolher('Escolher vídeo', arquivo('v.mp4', 'video/mp4'));
    fireEvent.click(await screen.findByRole('button', { name: 'Publicar story' }));
    expect(await screen.findByText(texto)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Escolher outro vídeo' })).toBeTruthy();
  }
});

test('torcedor vê "Só técnico de clube posta story"; admin sem clube posta como CBF', async () => {
  render(<CriarStory me={{ ...tecnico, clube: null }} />);
  expect(screen.getByText('Só técnico de clube posta story')).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Ver clubes livres' }).getAttribute('href')).toBe('/clubes');
  cleanup();
  render(<CriarStory me={{ ...tecnico, clube: null, isAdmin: true }} />);
  escolher('Escolher foto', arquivo('a.jpg', 'image/jpeg'));
  fireEvent.click(await screen.findByRole('button', { name: 'Publicar story' }));
  await waitFor(() => expect(envios[0]?.get('comoCbf')).toBe('true'));
});
