import { execFile } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { ApiError } from '../http.js';

const exec = promisify(execFile);
export const MAX_VIDEO_S = 30;
const TOLERANCIA_S = 0.5; // câmeras gravam "30 s" com 30,04: o contêiner arredonda
const LIMITE_CONVERSAO_MS = 90_000;
const LIMITE_SONDA_MS = 20_000;
const LADO_MAIOR = 1280;

export type Medida = { duracaoS: number; largura: number; altura: number; temVideo: boolean };
export type Convertido = { path: string; capaPath: string; largura: number; altura: number; duracaoS: number };

const uploads = () => process.env.UPLOADS_DIR ?? './uploads';
const publico = (pasta: string, nome: string) => `/uploads/${pasta}/${nome}`;
const apagar = (caminho: string) => unlink(caminho).catch(() => undefined);

/** ffprobe: duração e tamanho do primeiro fluxo de vídeo. Arquivo que não é vídeo (ou ffprobe falhou) → temVideo false, nunca lança. */
export async function medir(arquivo: string): Promise<Medida> {
  try {
    const { stdout } = await exec(
      'ffprobe',
      ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height:stream_side_data=rotation:format=duration', '-of', 'json', arquivo],
      { timeout: LIMITE_SONDA_MS, killSignal: 'SIGKILL' },
    );
    const j = JSON.parse(stdout) as { streams?: { width?: number; height?: number; side_data_list?: { rotation?: number }[] }[]; format?: { duration?: string } };
    const s = j.streams?.[0];
    const duracaoS = Number(j.format?.duration);
    if (!s?.width || !s.height || !Number.isFinite(duracaoS)) return { duracaoS: 0, largura: 0, altura: 0, temVideo: false };
    const gira = Math.abs(s.side_data_list?.find((d) => d.rotation !== undefined)?.rotation ?? 0) % 180 === 90; // iPhone em pé
    return { duracaoS, largura: gira ? s.height : s.width, altura: gira ? s.width : s.height, temVideo: true };
  } catch {
    return { duracaoS: 0, largura: 0, altura: 0, temVideo: false };
  }
}

/**
 * MP4 H.264 + AAC, lado maior 1280, +faststart, e capa JPG do 1º segundo, em UPLOADS_DIR/<pasta>/.
 * Passou de 90 s ou o ffmpeg falhou → VIDEO_INVALIDO e nenhum arquivo fica no disco.
 */
export async function converter(entrada: string, pasta: string): Promise<Convertido> {
  const dir = join(uploads(), pasta);
  await mkdir(dir, { recursive: true });
  const base = randomBytes(16).toString('hex');
  const mp4 = join(dir, `${base}.mp4`);
  const jpg = join(dir, `${base}.jpg`);
  try {
    // lado maior ≤ 1280 sem ampliar; as duas dimensões pares (exigência do H.264)
    const filtro = `scale='if(gte(iw,ih),min(${LADO_MAIOR},iw),-2)':'if(gte(iw,ih),-2,min(${LADO_MAIOR},ih))',scale=trunc(iw/2)*2:trunc(ih/2)*2`;
    await exec(
      'ffmpeg',
      ['-y', '-v', 'error', '-i', entrada, '-map', '0:v:0', '-map', '0:a:0?', '-vf', filtro, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '26', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', mp4],
      { timeout: LIMITE_CONVERSAO_MS, killSignal: 'SIGKILL' },
    );
    const m = await medir(mp4);
    if (!m.temVideo) throw new Error('saída sem vídeo');
    await exec('ffmpeg', ['-y', '-v', 'error', '-ss', m.duracaoS > 1 ? '1' : '0', '-i', mp4, '-frames:v', '1', '-q:v', '3', jpg], { timeout: LIMITE_SONDA_MS, killSignal: 'SIGKILL' });
    return { path: publico(pasta, `${base}.mp4`), capaPath: publico(pasta, `${base}.jpg`), largura: m.largura, altura: m.altura, duracaoS: m.duracaoS };
  } catch {
    await Promise.all([apagar(mp4), apagar(jpg)]);
    throw new ApiError(422, 'VIDEO_INVALIDO', 'Não consegui converter esse vídeo. Escolha outro.');
  }
}

/**
 * Valida (é vídeo, ≤ 30 s) e converte um upload em memória. O original só existe como arquivo temporário durante a conversão e é sempre apagado.
 * 400 VIDEO_LONGO / 422 VIDEO_INVALIDO; em erro nada fica no disco.
 */
export async function processarVideo(buffer: Buffer, pasta: string): Promise<Convertido> {
  const tmp = join(uploads(), 'tmp');
  await mkdir(tmp, { recursive: true });
  const original = join(tmp, `${randomBytes(16).toString('hex')}.bin`);
  await writeFile(original, buffer);
  try {
    const m = await medir(original);
    if (!m.temVideo) throw new ApiError(422, 'VIDEO_INVALIDO', 'Esse arquivo não é um vídeo que eu consiga ler.');
    if (m.duracaoS > MAX_VIDEO_S + TOLERANCIA_S) throw new ApiError(400, 'VIDEO_LONGO', `O vídeo passa de ${MAX_VIDEO_S} s (tem ${Math.round(m.duracaoS)} s).`);
    return await converter(original, pasta);
  } finally {
    await apagar(original);
  }
}
