import type { Post } from './tipos';

// Ao abrir um post/clube e voltar, o Feed remonta: guarda lista e rolagem para voltar ao mesmo ponto sem refazer a busca.
// Fica fora do Feed.tsx para o CardPost poder esquecê-lo sem import circular.
export type FeedGuardado = { meId: string; itens: Post[]; proximo: string | null; y: number; quando: number };
export const cacheFeed: { atual: FeedGuardado | null } = { atual: null };
export const esquecerFeed = () => (cacheFeed.atual = null); // chamar quando a lista muda por fora (ex.: post novo publicado)
