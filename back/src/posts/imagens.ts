import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/** JPEG começa com FF D8 FF. Buffer curto ou vazio → false. */
export const ehJpeg = (buf: Buffer) => buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;

/** Grava em UPLOADS_DIR/<pasta>/<32 hex>.jpg e devolve o caminho público (/uploads/<pasta>/…). */
export async function salvarImagem(buf: Buffer, pasta: string): Promise<string> {
  const nome = `${randomBytes(16).toString('hex')}.jpg`;
  const dir = join(process.env.UPLOADS_DIR ?? './uploads', pasta);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, nome), buf);
  return `/uploads/${pasta}/${nome}`;
}
