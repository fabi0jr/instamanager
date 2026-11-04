import type { ClubeMini } from '../api/cliente';

export type Story = { id: string; tipo: 'IMAGEM' | 'VIDEO'; url: string; capaUrl: string | null; criadoEm: string; visto: boolean };
export type FaixaClube = { clube: ClubeMini; stories: Story[]; todosVistos: boolean };

export const MAX_VIDEO_BYTES = 60 * 1024 * 1024;
export const MAX_VIDEO_S = 30;
export const mb = (n: number) => (n / 1048576).toFixed(1).replace('.', ',');
export const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

// mensagens dos erros de vídeo (mesmas no story e no post; valem para a conferência local e para a resposta do servidor)
export const ERROS_VIDEO = {
  VIDEO_LONGO: (s?: number) => ({ titulo: s ? `Esse vídeo tem ${Math.round(s)} s` : 'Esse vídeo é longo demais', texto: `O limite é ${MAX_VIDEO_S} s. Corte o vídeo na galeria do celular e escolha de novo.` }),
  VIDEO_INVALIDO: () => ({ titulo: 'Não deu para ler esse vídeo', texto: 'O arquivo não é um vídeo que o servidor consiga converter. Escolha outro.' }),
  VIDEO_GRANDE: () => ({ titulo: 'Esse arquivo passa de 60 MB', texto: 'Escolha um vídeo menor ou corte o vídeo na galeria do celular.' }),
} as const;
export type CodigoVideo = keyof typeof ERROS_VIDEO;

// lê a duração no próprio celular (sem enviar nada); null se o navegador não souber ler (aí o servidor decide)
export function duracaoDoArquivo(arquivo: File): Promise<number | null> {
  return new Promise((ok) => {
    const url = URL.createObjectURL(arquivo);
    const v = document.createElement('video');
    const fim = (d: number | null) => { URL.revokeObjectURL(url); v.removeAttribute('src'); ok(d); };
    v.preload = 'metadata';
    v.onloadedmetadata = () => fim(Number.isFinite(v.duration) ? v.duration : null);
    v.onerror = () => fim(null);
    setTimeout(() => fim(null), 4000);
    v.src = url;
  });
}

// erro do servidor → código de vídeo (400 VIDEO_LONGO, 422 VIDEO_INVALIDO, 413 arquivo grande)
export const codigoDeVideo = (status: number, codigo: string): CodigoVideo | null =>
  codigo === 'VIDEO_LONGO' ? 'VIDEO_LONGO' : codigo === 'VIDEO_INVALIDO' || status === 422 ? 'VIDEO_INVALIDO' : status === 413 ? 'VIDEO_GRANDE' : null;
