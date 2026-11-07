import { execFileSync } from 'node:child_process';

export const ACEITOS = ['mjpeg', 'png', 'webp']; // JPEG, PNG, WebP: imagem parada

// {codec, w, h} de uma imagem de verdade, ou null (não é mídia, ou largura/altura 0: HTML salvo como .png dá png,0,0)
export function sondaImagem(arq) {
  try {
    const [codec, w, h] = execFileSync('/usr/bin/ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=codec_name,width,height', '-of', 'csv=p=0', arq], { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim().split(',');
    return +w > 0 && +h > 0 ? { codec, w: +w, h: +h } : null;
  } catch { return null; }
}
