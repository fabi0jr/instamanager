import type { PrismaService } from '../prisma.service.js';

/** Quem recebe RESPOSTA: o autor do raiz e o do comentário respondido (`alvoId`), sem o próprio autor e sem repetir. */
export async function avisadosDaResposta(prisma: Pick<PrismaService, 'comment'>, c: { userId: string; parentId: string | null }, alvoId?: string): Promise<string[]> {
  if (!c.parentId) return [];
  const autores = await prisma.comment.findMany({ where: { id: { in: [c.parentId, alvoId ?? c.parentId] } }, select: { userId: true } });
  return [...new Set(autores.map((a) => a.userId))].filter((id) => id !== c.userId);
}
