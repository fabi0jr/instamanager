import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** Amostras de vídeo geradas pelo próprio ffmpeg (nada de binário no repositório). */
export function gerarAmostras() {
  const dir = mkdtempSync(join(tmpdir(), 'im-amostras-'));
  const gerar = (nome: string, ...args: string[]) => {
    execFileSync('ffmpeg', ['-y', '-v', 'error', ...args, join(dir, nome)]);
    return readFileSync(join(dir, nome));
  };
  return {
    /** 2 s HEVC/MOV como o iPhone grava, com áudio */
    hevcMov: gerar('iphone.mov', '-f', 'lavfi', '-i', 'testsrc=duration=2:size=640x360:rate=25', '-f', 'lavfi', '-i', 'sine=duration=2', '-c:v', 'libx265', '-tag:v', 'hvc1', '-c:a', 'aac', '-pix_fmt', 'yuv420p', '-x265-params', 'log-level=error'),
    /** 31 s: passa do limite */
    longo: gerar('longo.mp4', '-f', 'lavfi', '-i', 'testsrc=duration=31:size=160x90:rate=5', '-c:v', 'libx264', '-preset', 'ultrafast'),
    /** texto renomeado para .mp4 */
    texto: Buffer.from('isto não é um vídeo, só um texto renomeado'),
    /** 61 MB: passa do limite de envio (o conteúdo nem chega a ser lido) */
    grande: Buffer.alloc(61 * 1024 * 1024),
    limpar: () => rmSync(dir, { recursive: true, force: true }),
  };
}

/** Todos os arquivos que existem sob `dir` (recursivo); pasta que não existe = vazia. */
export const arquivosEm = (dir: string): string[] => {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => join(e.parentPath, e.name));
};
