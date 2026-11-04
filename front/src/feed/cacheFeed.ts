import type { Post } from './tipos';

// Ao abrir um post/clube e voltar, o Feed remonta: guarda lista e rolagem para voltar ao mesmo ponto sem refazer a busca.
// Fica fora do Feed.tsx para o CardPost poder esquecê-lo sem import circular.
export type FeedGuardado = { meId: string; itens: Post[]; proximo: string | null; y: number; quando: number };
export const cacheFeed: { atual: FeedGuardado | null } = { atual: null };
// "Ocultar para mim": o post sai do cache já no clique (não só depois dos 6 s do Desfazer) e volta se a pessoa desfizer.
// `escondidos` também vale para o cache que o Feed gravar ao desmontar, que ainda traz o card recolhido.
export const escondidos = new Map<string, number>(); // id → posição que tinha
export const esquecerFeed = () => { // chamar quando a lista muda por fora (ex.: post novo publicado)
  cacheFeed.atual = null;
  escondidos.clear();
};
export function esconderNoCache(post: Post) {
  const itens = cacheFeed.atual?.itens;
  const i = itens?.findIndex((p) => p.id === post.id) ?? -1;
  escondidos.set(post.id, i >= 0 ? i : 0);
  if (cacheFeed.atual && i >= 0) cacheFeed.atual = { ...cacheFeed.atual, itens: cacheFeed.atual.itens.filter((p) => p.id !== post.id) };
}
export function devolverAoCache(post: Post) {
  const i = escondidos.get(post.id);
  escondidos.delete(post.id);
  const c = cacheFeed.atual;
  if (c && i !== undefined && !c.itens.some((p) => p.id === post.id)) {
    const itens = [...c.itens];
    itens.splice(Math.min(i, itens.length), 0, post);
    cacheFeed.atual = { ...c, itens };
  }
}
