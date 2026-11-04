import type { Prisma } from '../generated/prisma/client.js';

/**
 * ÚNICO filtro de visibilidade de posts: feed, clube, tag, galeria, fixados, /posts/:id e tudo que acha um post por id passam por aqui.
 * - post ocultado pelo admin: só o admin vê;
 * - "ocultar para mim": some das listas de quem ocultou (`lista: false` = acesso direto por id, que não esconde).
 */
export const ondeVisivel = (userId: string, isAdmin: boolean, { lista = true } = {}): Prisma.PostWhereInput => ({
  ...(!isAdmin && { hiddenAt: null }),
  ...(lista && { hiddenBy: { none: { userId } } }),
});

/** Comentário ocultado pelo admin: só o admin vê. */
export const comentariosVisiveis = (isAdmin: boolean): Prisma.CommentWhereInput => (isAdmin ? {} : { hiddenAt: null });
