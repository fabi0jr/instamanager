import type { ClubeMini } from '../api/cliente';

export type ImagemPost = { id: string; miniUrl: string; cheiaUrl: string; largura: number; altura: number; prompt: string | null };
export const REACOES = [
  { emoji: '❤️', nome: 'Coração' },
  { emoji: '🔥', nome: 'Fogo' },
  { emoji: '😂', nome: 'Risada' },
  { emoji: '😮', nome: 'Surpresa' },
  { emoji: '😢', nome: 'Triste' },
  { emoji: '👏', nome: 'Palmas' },
] as const;
export type Emoji = (typeof REACOES)[number]['emoji'];
export const nomeDe = (e: string) => REACOES.find((r) => r.emoji === e)?.nome ?? e;
export type Post = {
  id: string;
  clube: ClubeMini;
  autor: { id: string; nome: string };
  legenda: string;
  // campos do pack 2 (opcionais: o app tolera resposta de servidor antigo)
  texto?: string | null; // post só de texto: imagens = [] e legenda = ''
  video?: { url: string; capaUrl: string; duracaoS: number; largura: number; altura: number } | null; // post de vídeo: imagens = []
  mencoes?: { id: string; nome: string }[]; // nomes de hoje, do banco, das @[Nome](id) da legenda/texto
  fixado?: boolean;
  oculto?: boolean;
  criadoEm: string;
  imagens: ImagemPost[];
  curtidas: number;
  curtiu: boolean;
  reacoes?: { emoji: string; total: number }[]; // até 3, a mais usada primeiro
  minhaReacao?: Emoji | null;
  comentarios: number;
  podeEditar: boolean;
};
export type Pagina<T> = { itens: T[]; proximo: string | null; fixados?: T[] };
export type Comentario = {
  id: string;
  texto: string;
  mencoes?: { id: string; nome: string }[];
  criadoEm: string;
  oculto?: boolean; // só o admin recebe comentário oculto
  usuario: { id: string; nome: string; avatarUrl: string | null; clube: { id: string; nome: string } | null };
};

export function haQuanto(iso: string) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  const [n, un] = s < 60 ? [0, ''] : s < 3600 ? [s / 60, 'minuto'] : s < 86400 ? [s / 3600, 'hora'] : s < 2592000 ? [s / 86400, 'dia'] : [s / 2592000, 'mês'];
  if (!un) return 'agora';
  const k = Math.floor(n);
  return `há ${k} ${un === 'mês' ? (k > 1 ? 'meses' : 'mês') : k > 1 ? un + 's' : un}`;
}
