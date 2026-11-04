import { Injectable } from '@nestjs/common';
import type { UserComClube } from '../auth/auth.service.js';
import type { NotificacaoTipo } from '../generated/prisma/client.js';
import { extrairMencoes, resolverMencoes, semMarcas } from '../mencoes.js';
import { codificarCursor, decodificarCursor } from '../posts/cursor.js';
import { ondeVisivel } from '../posts/visibilidade.js';
import { PrismaService } from '../prisma.service.js';
import { PushService } from '../push/push.service.js';

const POR_PAGINA = 20;
const RESUMO_MAX = 80;
const PESSOAS_MAX = 8;
const INDISPONIVEL = 'Post indisponível';
const curto = (t: string) => (t.length > RESUMO_MAX ? `${t.slice(0, RESUMO_MAX - 1)}…` : t);
// % e _ do que a pessoa digitou valem como texto
const escapar = (q: string) => q.replace(/[\\%_]/g, '\\$&');

type Extra = { atorId?: string; postId?: string; comentarioId?: string; votacaoId?: string };

@Injectable()
export class AtividadeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly push: PushService,
  ) {}

  /** Grava um item para cada destinatário, menos para quem fez a ação (ninguém é avisado da própria ação). */
  async criar(userIds: string[], tipo: NotificacaoTipo, extra: Extra = {}) {
    const alvos = [...new Set(userIds)].filter((id) => id !== extra.atorId);
    if (alvos.length) await this.prisma.notificacao.createMany({ data: alvos.map((userId) => ({ userId, tipo, ...extra })) });
  }

  /** Reação no post do clube: o técnico atual recebe 1 item por pessoa por post; reagir de novo troca o item (volta a não lido). */
  async reacao(postId: string, atorId: string) {
    const p = await this.prisma.post.findUnique({ where: { id: postId }, select: { club: { select: { coachId: true } } } });
    const tecnico = p?.club.coachId;
    if (!tecnico || tecnico === atorId) return;
    await this.prisma.$transaction([
      this.prisma.notificacao.deleteMany({ where: { userId: tecnico, tipo: 'REACAO', atorId, postId } }),
      this.prisma.notificacao.create({ data: { userId: tecnico, tipo: 'REACAO', atorId, postId } }),
    ]);
  }

  async comentario(comentarioId: string) {
    const c = await this.prisma.comment.findUnique({ where: { id: comentarioId }, include: { post: { select: { club: { select: { coachId: true } } } } } });
    if (!c) return;
    const tecnico = c.post.club.coachId;
    if (tecnico) await this.criar([tecnico], 'COMENTARIO', { atorId: c.userId, postId: c.postId, comentarioId });
    // o técnico já recebe o aviso de comentário (e o push); não ganha um segundo item por ser mencionado no mesmo texto
    await this.mencionar(c.text, c.userId, c.postId, comentarioId, tecnico ? [tecnico] : []);
  }

  /** Menções do texto de um post (legenda ou texto) ou comentário. Quem já foi avisado por este mesmo texto não é avisado de novo (editar não repete). */
  async mencionar(texto: string, atorId: string, postId: string, comentarioId?: string, ignorar: string[] = []) {
    const validos = (await resolverMencoes(this.prisma, extrairMencoes(texto))).map((m) => m.id).filter((id) => id !== atorId && !ignorar.includes(id));
    if (!validos.length) return;
    const ja = await this.prisma.notificacao.findMany({ where: { tipo: 'MENCAO', postId, comentarioId: comentarioId ?? null, userId: { in: validos } }, select: { userId: true } });
    const novos = validos.filter((id) => !ja.some((j) => j.userId === id));
    if (!novos.length) return;
    await this.criar(novos, 'MENCAO', { atorId, postId, ...(comentarioId && { comentarioId }) });
    const ator = await this.prisma.user.findUnique({ where: { id: atorId }, select: { name: true } });
    void this.push.enviar(novos, { titulo: 'Menção', corpo: `${ator?.name ?? 'Alguém'} mencionou você`, url: `/p/${postId}` });
  }

  /** Itens do usuário, do mais novo ao mais velho. Post oculto/apagado vira "Post indisponível" (sem legenda nem foto). */
  async listar(user: UserComClube, antes?: string) {
    const c = decodificarCursor(antes);
    const itens = await this.prisma.notificacao.findMany({
      where: { userId: user.id, ...(c && { OR: [{ createdAt: { lt: c.criadoEm } }, { createdAt: c.criadoEm, id: { lt: c.id } }] }) },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: POR_PAGINA + 1,
      include: { ator: { select: { id: true, name: true, avatarPath: true } }, votacao: { select: { id: true, titulo: true } } },
    });
    const pagina = itens.slice(0, POR_PAGINA);
    const ids = [...new Set(pagina.flatMap((n) => (n.postId ? [n.postId] : [])))];
    const visiveis = ids.length
      ? await this.prisma.post.findMany({ where: { id: { in: ids }, ...ondeVisivel(user.id, user.isAdmin, { lista: false }) }, include: { images: { orderBy: { position: 'asc' }, take: 1 } } })
      : [];
    const resumoDe = (p: (typeof visiveis)[number]) => curto(semMarcas(p.texto ?? (p.caption || (p.images.length ? 'Post com imagem' : 'Post'))));
    const ultimo = pagina.at(-1);
    return {
      itens: pagina.map((n) => {
        const p = visiveis.find((v) => v.id === n.postId);
        return {
          id: n.id,
          tipo: n.tipo,
          criadoEm: n.createdAt,
          lida: n.lidaEm !== null,
          ator: n.ator && { id: n.ator.id, nome: n.ator.name, avatarUrl: n.ator.avatarPath },
          post: n.postId ? { id: n.postId, miniUrl: p?.images[0]?.thumbPath ?? null, resumo: p ? resumoDe(p) : INDISPONIVEL } : null,
          votacao: n.votacao,
        };
      }),
      proximo: itens.length > POR_PAGINA && ultimo ? codificarCursor(ultimo.createdAt, ultimo.id) : null,
    };
  }

  async naoLidas(userId: string) {
    return { total: await this.prisma.notificacao.count({ where: { userId, lidaEm: null } }) };
  }

  async marcarLidas(userId: string) {
    await this.prisma.notificacao.updateMany({ where: { userId, lidaEm: null }, data: { lidaEm: new Date() } });
  }

  /** Autocompletar de @: nome sem acento e sem diferenciar maiúsculas; quem começa com o texto vem primeiro. */
  async pessoas(q: unknown) {
    const t = typeof q === 'string' ? q.trim().slice(0, 60) : '';
    if (t.length < 2) return [];
    const achados = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM "User"
      WHERE lower(unaccent(name)) LIKE '%' || lower(unaccent(${escapar(t)})) || '%'
      ORDER BY (lower(unaccent(name)) LIKE lower(unaccent(${escapar(t)})) || '%') DESC, name ASC, id ASC
      LIMIT ${PESSOAS_MAX}`;
    const us = await this.prisma.user.findMany({ where: { id: { in: achados.map((a) => a.id) } }, include: { club: { select: { id: true, name: true, crestPath: true } } } });
    return achados.flatMap(({ id }) => us.filter((u) => u.id === id)).map((u) => ({ id: u.id, nome: u.name, avatarUrl: u.avatarPath, clube: u.club && { id: u.club.id, nome: u.club.name, escudoUrl: u.club.crestPath } }));
  }
}
