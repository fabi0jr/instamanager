import type { ClubeMini } from '../api/cliente';

export type ImagemPost = { id: string; miniUrl: string; cheiaUrl: string; largura: number; altura: number; prompt: string | null };
export type Post = {
  id: string;
  clube: ClubeMini;
  autor: { id: string; nome: string };
  legenda: string;
  criadoEm: string;
  imagens: ImagemPost[];
  curtidas: number;
  curtiu: boolean;
  comentarios: number;
  podeEditar: boolean;
};
export type Pagina<T> = { itens: T[]; proximo: string | null };
export type Comentario = {
  id: string;
  texto: string;
  criadoEm: string;
  usuario: { id: string; nome: string; avatarUrl: string | null; clube: { id: string; nome: string } | null };
};

export function haQuanto(iso: string) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  const [n, un] = s < 60 ? [0, ''] : s < 3600 ? [s / 60, 'minuto'] : s < 86400 ? [s / 3600, 'hora'] : s < 2592000 ? [s / 86400, 'dia'] : [s / 2592000, 'mês'];
  if (!un) return 'agora';
  const k = Math.floor(n);
  return `há ${k} ${un === 'mês' ? (k > 1 ? 'meses' : 'mês') : k > 1 ? un + 's' : un}`;
}
