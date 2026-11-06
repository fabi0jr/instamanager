import { cleanup, createEvent, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type { Me } from '../api/cliente';
import { fetchFalso } from '../testes/fetchFalso';
import { Postar } from './Postar';

vi.mock('./comprimir', async (o) => ({
  ...(await o<typeof import('./comprimir')>()),
  comprimir: vi.fn(async (a: File, lado: number) => ({ blob: new Blob([`${a.name}:${lado}`], { type: 'image/jpeg' }), largura: lado, altura: lado })),
}));
vi.mock('../stories/tipos', async (o) => ({ ...(await o<typeof import('../stories/tipos')>()), duracaoDoArquivo: vi.fn(async () => 12) }));

const clube = { id: 'p', nome: 'Palmeiras', escudoUrl: '/e.svg' };
const me: Me = { id: 'u1', nome: 'L', email: 'l@x.com', avatarUrl: null, isAdmin: false, pushEnabled: false, clube };
const img = (n: string) => new File(['x'], n, { type: 'image/jpeg' });
const vid = (n: string) => new File(['x'], n, { type: 'video/mp4' });
const CAIXA = 'Arraste as imagens ou o vídeo aqui, ou clique para escolher';
const soltar = (alvo: Element, files: File[]) => fireEvent.drop(alvo, { dataTransfer: { files, types: ['Files'] } });

function mouse(sim: boolean) {
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: sim && q.includes('hover: hover'), media: q, addEventListener() {}, removeEventListener() {} }));
}
beforeEach(() => {
  fetchFalso({});
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:x'), revokeObjectURL: vi.fn() }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); localStorage.clear(); });

test('celular (sem mouse): nada de caixa, o botão é o de sempre', () => {
  mouse(false);
  render(<Postar me={me} />);
  expect(screen.queryByText(CAIXA)).toBeNull();
  expect(screen.getByText('Escolher imagens').className).toContain('botao');
});

test('no computador: caixa com destaque no dragover; clicar continua ligado ao seletor', () => {
  mouse(true);
  render(<Postar me={me} />);
  const caixa = screen.getByText(CAIXA);
  expect(caixa.getAttribute('for')).toBe('arquivos-postar');
  fireEvent.dragOver(caixa);
  expect(caixa.className).toContain('sobre');
  fireEvent.dragLeave(caixa);
  expect(caixa.className).not.toContain('sobre');
});

test('imagens soltas entram como se viessem do seletor', async () => {
  mouse(true);
  render(<Postar me={me} />);
  soltar(screen.getByText(CAIXA), [img('a.jpg'), img('b.jpg')]);
  expect(await screen.findByText(/2 de 10 imagens/)).toBeTruthy();
  expect((await screen.findByRole('button', { name: 'Continuar' }) as HTMLButtonElement).disabled).toBe(false);
});

test('vídeo solto na aba Foto troca para a aba Vídeo e escolhe o arquivo', async () => {
  mouse(true);
  render(<Postar me={me} />);
  soltar(screen.getByText(CAIXA), [vid('g.mp4')]);
  expect(screen.getByRole('radio', { name: 'Vídeo' }).getAttribute('aria-checked')).toBe('true');
  expect(await screen.findByText('g.mp4')).toBeTruthy();
});

test('imagem solta na aba Vídeo troca para a aba Foto', async () => {
  mouse(true);
  localStorage.setItem('im:postar-modo', 'video');
  render(<Postar me={me} />);
  soltar(screen.getByText(CAIXA), [img('a.jpg')]);
  expect(screen.getByRole('radio', { name: 'Foto' }).getAttribute('aria-checked')).toBe('true');
  expect(await screen.findByText(/1 de 10 imagens/)).toBeTruthy();
});

test('vídeo com limite estourado usa as mesmas validações do seletor', async () => {
  mouse(true);
  localStorage.setItem('im:postar-modo', 'video');
  render(<Postar me={me} />);
  const grande = vid('g.mp4');
  Object.defineProperty(grande, 'size', { value: 61 * 1024 * 1024 });
  soltar(screen.getByText(CAIXA), [grande]);
  expect((await screen.findByRole('alert')).textContent).toContain('passa de 60 MB');
});

test('vídeo de 61 MB solto na aba Foto é recusado antes de trocar de aba (nada de diálogo de descartar)', () => {
  mouse(true);
  render(<Postar me={me} />);
  const grande = vid('g.mp4');
  Object.defineProperty(grande, 'size', { value: 61 * 1024 * 1024 });
  soltar(screen.getByText(CAIXA), [grande]);
  expect(screen.getByRole('alert').textContent).toContain('passa de 60 MB');
  expect(screen.getByRole('radio', { name: 'Foto' }).getAttribute('aria-checked')).toBe('true');
  expect(screen.queryByRole('dialog')).toBeNull();
});

test('só os tipos do seletor: GIF, BMP e SVG dão erro de tipo; HEIC sem type passa pela extensão', async () => {
  mouse(true);
  render(<Postar me={me} />);
  const caixa = screen.getByText(CAIXA);
  for (const f of [new File(['x'], 'a.gif', { type: 'image/gif' }), new File(['x'], 'a.bmp', { type: 'image/bmp' }), new File(['x'], 'a.svg', { type: 'image/svg+xml' })]) {
    soltar(caixa, [f]);
    expect(screen.getByRole('alert').textContent).toContain('tipo de arquivo não vale');
  }
  expect(screen.queryByText(/de 10 imagens/)).toBeNull();
  soltar(caixa, [new File(['x'], 'a.heic')]);
  expect(await screen.findByText(/1 de 10 imagens/)).toBeTruthy();
});

test('imagem + vídeo juntos, tipo não aceito e vários vídeos dão erro claro, sem trocar de aba', () => {
  mouse(true);
  render(<Postar me={me} />);
  const caixa = screen.getByText(CAIXA);
  soltar(caixa, [img('a.jpg'), vid('v.mp4')]);
  expect(screen.getByRole('alert').textContent).toContain('Imagem e vídeo não vão juntos');
  soltar(caixa, [new File(['x'], 'a.pdf', { type: 'application/pdf' })]);
  expect(screen.getByRole('alert').textContent).toContain('tipo de arquivo não vale');
  soltar(caixa, [vid('1.mp4'), vid('2.mp4')]);
  expect(screen.getByRole('alert').textContent).toContain('só um vídeo');
  expect(screen.getByRole('radio', { name: 'Foto' }).getAttribute('aria-checked')).toBe('true');
});

test('soltar arquivo fora da caixa não deixa o navegador abrir o arquivo', () => {
  mouse(true);
  render(<Postar me={me} />);
  const e = createEvent.drop(document.body, { dataTransfer: { files: [img('a.jpg')], types: ['Files'] } });
  fireEvent(document.body, e);
  expect(e.defaultPrevented).toBe(true);
  const sobre = createEvent.dragOver(document.body, { dataTransfer: { files: [], types: ['Files'] } });
  fireEvent(document.body, sobre);
  expect(sobre.defaultPrevented).toBe(true);
});
