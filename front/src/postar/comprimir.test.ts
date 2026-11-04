import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { comprimir, comprimirCapa, ErroImagem } from './comprimir';

let canvas: any;
beforeEach(() => {
  canvas = { width: 0, height: 0 };
  vi.spyOn(document, 'createElement').mockImplementation(((tag: string) =>
    tag === 'canvas'
      ? Object.assign(canvas, {
          getContext: () => ({ drawImage: vi.fn() }),
          toBlob: (cb: (b: Blob) => void, tipo: string, q: number) => cb(new Blob(['x'], { type: tipo + q })),
        })
      : Document.prototype.createElement.call(document, tag)) as never);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
const imagem = (largura: number, altura: number) =>
  vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ width: largura, height: altura, close: vi.fn() })));

test('comprimir 4000×3000 com ladoMax 1600 → 1600×1200', async () => {
  imagem(4000, 3000);
  const r = await comprimir(new File(['x'], 'a.jpg'), 1600);
  expect([r.largura, r.altura]).toEqual([1600, 1200]);
  expect([canvas.width, canvas.height]).toEqual([1600, 1200]);
  expect(r.blob.type).toBe('image/jpeg0.82');
  expect(createImageBitmap).toHaveBeenCalledWith(expect.anything(), { imageOrientation: 'from-image' });
});

test('imagem menor que ladoMax não aumenta', async () => {
  imagem(300, 200);
  const r = await comprimir(new File(['x'], 'a.jpg'), 1600);
  expect([r.largura, r.altura]).toEqual([300, 200]);
});

test('arquivo ilegível → ErroImagem', async () => {
  vi.stubGlobal('createImageBitmap', vi.fn(async () => Promise.reject(new Error('x'))));
  await expect(comprimir(new File(['x'], 'a.jpg'), 480)).rejects.toBeInstanceOf(ErroImagem);
});

test('canvas sem contexto 2d → ErroImagem', async () => {
  imagem(100, 100);
  canvas.getContext = () => null;
  vi.mocked(document.createElement).mockImplementation((() => canvas) as never);
  await expect(comprimir(new File(['x'], 'a.jpg'), 480)).rejects.toBeInstanceOf(ErroImagem);
});

test('comprimirCapa: recorta no centro para 3:1 e entrega 1500×500 em JPEG 0,82', async () => {
  const drawImage = vi.fn();
  vi.mocked(document.createElement).mockImplementation((() =>
    Object.assign(canvas, { getContext: () => ({ drawImage }), toBlob: (cb: (b: Blob) => void, t: string, q: number) => cb(new Blob(['x'], { type: t + q })) })) as never);
  imagem(4000, 3000); // mais "alta" que 3:1: corta em cima e embaixo
  const blob = await comprimirCapa(new File(['x'], 'a.jpg'));
  expect([canvas.width, canvas.height]).toEqual([1500, 500]);
  expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 834, 4000, 1333, 0, 0, 1500, 500);
  expect(blob.type).toBe('image/jpeg0.82');
  drawImage.mockClear();
  imagem(6000, 1000); // mais larga que 3:1: corta dos lados
  await comprimirCapa(new File(['x'], 'b.jpg'));
  expect(drawImage).toHaveBeenCalledWith(expect.anything(), 1500, 0, 3000, 1000, 0, 0, 1500, 500);
});

test('comprimirCapa: arquivo ilegível → ErroImagem', async () => {
  vi.stubGlobal('createImageBitmap', vi.fn(async () => Promise.reject(new Error('x'))));
  await expect(comprimirCapa(new File(['x'], 'a.jpg'))).rejects.toBeInstanceOf(ErroImagem);
});
