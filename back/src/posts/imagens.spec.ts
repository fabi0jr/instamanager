import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { montarJpeg } from '../../test/jpeg.js';
import { dimensoesJpeg, ehJpeg, salvarImagem } from './imagens.js';

const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);

describe('imagens', () => {
  it('ehJpeg: true para FF D8 FF, false para PNG e buffer vazio', () => {
    expect(ehJpeg(jpeg)).toBe(true);
    expect(ehJpeg(Buffer.from([0x89, 0x50, 0x4e, 0x47]))).toBe(false);
    expect(ehJpeg(Buffer.alloc(0))).toBe(false);
  });

  it('salvarImagem grava .jpg com nome aleatório em UPLOADS_DIR e devolve o caminho público', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'im-'));
    vi.stubEnv('UPLOADS_DIR', dir);
    try {
      const a = await salvarImagem(jpeg, 'avatares');
      const b = await salvarImagem(jpeg, 'avatares');
      expect(a).toMatch(/^\/uploads\/avatares\/[0-9a-f]{32}\.jpg$/);
      expect(a).not.toBe(b);
      expect(await readFile(join(dir, a.replace('/uploads/', '')))).toEqual(jpeg);
    } finally {
      vi.unstubAllEnvs();
      await rm(dir, { recursive: true });
    }
  });

  it('dimensoesJpeg lê largura e altura do SOF; sem SOF → null', () => {
    expect(dimensoesJpeg(montarJpeg(1600, 1200))).toEqual({ largura: 1600, altura: 1200 });
    expect(dimensoesJpeg(montarJpeg(480, 360, 100))).toEqual({ largura: 480, altura: 360 });
    expect(dimensoesJpeg(jpeg)).toBeNull();
    expect(dimensoesJpeg(Buffer.alloc(0))).toBeNull();
  });
});
