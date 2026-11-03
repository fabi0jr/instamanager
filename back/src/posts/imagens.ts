import { randomBytes } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
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

/** Largura e altura lidas do primeiro SOF (marcador de quadro) do JPEG, ou null se não achar. */
export function dimensoesJpeg(buf: Buffer): { largura: number; altura: number } | null {
  let pos = 2;
  while (ehJpeg(buf) && pos + 4 <= buf.length) {
    if (buf[pos] !== 0xff) return null;
    const marcador = buf[pos + 1];
    if (marcador === 0xff) { pos++; continue; } // bytes de enchimento
    if (marcador === 0x01 || (marcador >= 0xd0 && marcador <= 0xd8)) { pos += 2; continue; } // sem tamanho
    if (marcador === 0xd9 || marcador === 0xda) return null; // fim, ou dados sem SOF antes
    const sof = marcador >= 0xc0 && marcador <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marcador);
    if (sof) {
      if (pos + 9 > buf.length) return null;
      const altura = buf.readUInt16BE(pos + 5);
      const largura = buf.readUInt16BE(pos + 7);
      return largura > 0 && altura > 0 ? { largura, altura } : null;
    }
    pos += 2 + buf.readUInt16BE(pos + 2);
  }
  return null;
}

/** Apaga um arquivo pelo caminho público (/uploads/…). Falha ao apagar não derruba nada: é só lixo no disco. */
export async function apagarImagem(caminhoPublico: string): Promise<void> {
  await unlink(join(process.env.UPLOADS_DIR ?? './uploads', caminhoPublico.replace(/^\/uploads\//, ''))).catch(() => undefined);
}
