import type { PrismaService } from './prisma.service.js';

export const MAX_MENCOES = 10;
// `@[Nome](uuid)`: o nome do texto é só para quem lê o texto cru; o que vale é o id, e o nome mostrado vem do banco
const MENCAO = /@\[[^\]\n]*\]\(([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\)/gi;

/** Ids (minúsculos, sem repetir, na ordem do texto) das menções no formato guardado; no máximo 10. */
export function extrairMencoes(texto: string): string[] {
  const ids = new Set<string>();
  for (const m of texto.matchAll(MENCAO)) ids.add(m[1].toLowerCase());
  return [...ids].slice(0, MAX_MENCOES);
}

/** Só os ids que são usuários de verdade, com o nome de hoje (id inexistente é ignorado). */
export async function resolverMencoes(prisma: Pick<PrismaService, 'user'>, ids: string[]): Promise<{ id: string; nome: string }[]> {
  if (!ids.length) return [];
  const us = await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } });
  return ids.flatMap((id) => us.filter((u) => u.id === id).map((u) => ({ id: u.id, nome: u.name })));
}

/** Troca cada `@[texto](uuid)` por `@Nome` com o nome do banco (o texto escrito não vale); id que não resolveu some. */
export const comNomes = (texto: string, mencoes: { id: string; nome: string }[]) =>
  texto.replace(/@\[[^\]\n]*\]\(([0-9a-f-]{36})\)/gi, (_, id: string) => {
    const m = mencoes.find((x) => x.id === id.toLowerCase());
    return m ? `@${m.nome}` : '';
  });
