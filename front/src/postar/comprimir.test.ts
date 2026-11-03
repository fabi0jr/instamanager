import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { comprimir, ErroImagem } from './comprimir';

let canvas: { width: number; height: number };
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
