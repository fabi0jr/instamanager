import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { converter, ehContainerPermitido, medir, processarVideo } from './video.js';

// amostras geradas pelo próprio ffmpeg: nada de binário no repositório
let dir: string;
let hevcMov: string;
let longo: string;
let texto: string;
const gerar = (saida: string, ...args: string[]) => execFileSync('ffmpeg', ['-y', '-v', 'error', ...args, saida]);
const arquivosEm = (d: string): string[] => readdirSync(d, { recursive: true, withFileTypes: true }).filter((e) => e.isFile()).map((e) => join(e.parentPath, e.name));

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'im-video-'));
  process.env.UPLOADS_DIR = join(dir, 'uploads');
  hevcMov = join(dir, 'iphone.mov');
  gerar(hevcMov, '-f', 'lavfi', '-i', 'testsrc=duration=2:size=1920x1080:rate=25', '-f', 'lavfi', '-i', 'sine=duration=2', '-c:v', 'libx265', '-tag:v', 'hvc1', '-c:a', 'aac', '-pix_fmt', 'yuv420p', '-x265-params', 'log-level=error');
  longo = join(dir, 'longo.mp4');
  gerar(longo, '-f', 'lavfi', '-i', 'testsrc=duration=31:size=160x90:rate=5', '-c:v', 'libx264', '-preset', 'ultrafast');
  texto = join(dir, 'texto.mp4');
  writeFileSync(texto, 'isto não é um vídeo, só um texto renomeado');
});
afterAll(() => {
  delete process.env.UPLOADS_DIR;
  rmSync(dir, { recursive: true, force: true });
});

describe('video', () => {
  it('medir lê duração e tamanho', async () => {
    const m = await medir(hevcMov);
    expect(m).toMatchObject({ largura: 1920, altura: 1080, temVideo: true });
    expect(m.duracaoS).toBeGreaterThan(1.8);
    expect(m.duracaoS).toBeLessThan(2.3);
  });

  it('arquivo de texto → temVideo false (e arquivo que não existe também)', async () => {
    expect((await medir(texto)).temVideo).toBe(false);
    expect((await medir(join(dir, 'nao-existe.mp4'))).temVideo).toBe(false);
  });

  it('converter HEVC/MOV gera mp4 h264 720p com capa jpg', async () => {
    const r = await converter(hevcMov, 'videos');
    expect(r).toMatchObject({ largura: 1280, altura: 720 });
    expect(r.path).toMatch(/^\/uploads\/videos\/[0-9a-f]{32}\.mp4$/);
    const mp4 = join(process.env.UPLOADS_DIR!, r.path.replace('/uploads/', ''));
    const info = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_name,codec_type,pix_fmt', '-of', 'json', mp4]).toString()) as { streams: { codec_name: string; codec_type: string; pix_fmt?: string }[] };
    expect(info.streams.find((s) => s.codec_type === 'video')).toMatchObject({ codec_name: 'h264', pix_fmt: 'yuv420p' });
    expect(info.streams.find((s) => s.codec_type === 'audio')?.codec_name).toBe('aac');
    const jpg = readFileSync(join(process.env.UPLOADS_DIR!, r.capaPath.replace('/uploads/', '')));
    expect([...jpg.subarray(0, 3)]).toEqual([0xff, 0xd8, 0xff]);
    // +faststart: o átomo moov vem antes do mdat
    const bytes = readFileSync(mp4);
    expect(bytes.indexOf('moov')).toBeGreaterThan(-1);
    expect(bytes.indexOf('moov')).toBeLessThan(bytes.indexOf('mdat'));
  });

  it('processarVideo: texto → 422 VIDEO_INVALIDO; 31 s → 400 VIDEO_LONGO; nada fica no disco (nem o temporário)', async () => {
    const antes = existsSync(process.env.UPLOADS_DIR!) ? arquivosEm(process.env.UPLOADS_DIR!).length : 0;
    await expect(processarVideo(readFileSync(texto), 'videos')).rejects.toMatchObject({ status: 422, response: { codigo: 'VIDEO_INVALIDO' } });
    await expect(processarVideo(readFileSync(longo), 'videos')).rejects.toMatchObject({ status: 400, response: { codigo: 'VIDEO_LONGO' } });
    expect(arquivosEm(process.env.UPLOADS_DIR!).length).toBe(antes);
  });

  it('processarVideo aceita o MOV do iPhone e só deixa o mp4 e a capa', async () => {
    const antes = arquivosEm(process.env.UPLOADS_DIR!).length;
    const r = await processarVideo(readFileSync(hevcMov), 'stories');
    expect(r.duracaoS).toBeGreaterThan(1.5);
    expect(arquivosEm(process.env.UPLOADS_DIR!).length).toBe(antes + 2);
  });

  it('playlist HLS e ffconcat disfarçados de .mp4 são recusados sem ler o arquivo apontado nem abrir URL', async () => {
    const alvo = join(dir, 'segredo.txt');
    writeFileSync(alvo, 'conteudo-secreto');
    const hls = Buffer.from(`#EXTM3U\n#EXT-X-TARGETDURATION:1\n#EXTINF:1,\nfile://${alvo}\n#EXTINF:1,\nhttp://127.0.0.1:9/x.ts\n#EXT-X-ENDLIST\n`);
    const concat = Buffer.from(`ffconcat version 1.0\nfile '${alvo}'\n`);
    for (const falso of [hls, concat]) {
      expect(ehContainerPermitido(falso)).toBe(false);
      await expect(processarVideo(falso, 'videos')).rejects.toMatchObject({ status: 422, response: { codigo: 'VIDEO_INVALIDO' } });
      // mesmo que passasse da conferência dos bytes, o ffprobe com protocolo só `file` e lista de formatos não o aceita como vídeo
      const f = join(dir, 'falso.mp4');
      writeFileSync(f, falso);
      expect((await medir(f)).temVideo).toBe(false);
    }
  });

  it('conferência dos bytes aceita MP4/MOV e Matroska e recusa o resto', () => {
    expect(ehContainerPermitido(readFileSync(hevcMov))).toBe(true);
    expect(ehContainerPermitido(Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0, 0, 0, 0, 0, 0, 0, 0]))).toBe(true);
    expect(ehContainerPermitido(Buffer.from('RIFF....AVI LIST'))).toBe(false);
    expect(ehContainerPermitido(Buffer.alloc(0))).toBe(false);
  });
});
