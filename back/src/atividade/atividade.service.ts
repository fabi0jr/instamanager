import { Injectable } from '@nestjs/common';
import type { UserComClube } from '../auth/auth.service.js';
import type { NotificacaoTipo } from '../generated/prisma/client.js';
import { escaparLike } from '../like.js';
import { comNomes, extrairMencoes, resolverMencoes } from '../mencoes.js';
import { codificarCursor, decodificarCursor } from '../posts/cursor.js';
import { ondeVisivel } from '../posts/visibilidade.js';
import { PrismaService } from '../prisma.service.js';
import { PushService } from '../push/push.service.js';

const POR_PAGINA = 20;
const RESUMO_MAX = 80;
const PESSOAS_MAX = 8;
const INDISPONIVEL = 'Post indisponível';
const INDISPONIVEL_COMENTARIO = 'Comentário indisponível';
const curto = (t: string) => (t.length > RESUMO_MAX ? `${t.slice(0, RESUMO_MAX - 1)}…` : t);

type Extra = { atorId?: string; postId?: string; comentarioId?: string; votacaoId?: string; trocaId?: string };

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
      include: { ator: { select: { id: true, name: true, avatarPath: true } }, votacao: { select: { id: true, titulo: true } }, comentario: { select: { id: true, text: true, hiddenAt: true } }, troca: { select: { status: true, club: { select: { id: true, name: true, crestPath: true } } } } },
    });
    const pagina = itens.slice(0, POR_PAGINA);
    const ids = [...new Set(pagina.flatMap((n) => (n.postId ? [n.postId] : [])))];
    const visiveis = ids.length
      ? await this.prisma.post.findMany({ where: { id: { in: ids }, ...ondeVisivel(user.id, user.isAdmin, { lista: false }) }, include: { images: { orderBy: { position: 'asc' }, take: 1 }, video: { select: { capaPath: true } } } })
      : [];
    const textoDe = (p: (typeof visiveis)[number]) => p.texto ?? (p.caption || (p.images.length ? 'Post com imagem' : p.video ? 'Post com vídeo' : 'Post'));
    // comentário só aparece se o post está visível e o comentário não foi ocultado pelo admin (o admin vê tudo)
    const comentarioVisivel = (n: (typeof pagina)[number]) => n.comentario && visiveis.some((v) => v.id === n.postId) && (user.isAdmin || n.comentario.hiddenAt === null) ? n.comentario.text : null;
    const comTexto = (n: (typeof pagina)[number]) => n.tipo === 'COMENTARIO' || n.tipo === 'MENCAO'; // MENCAO feita dentro de comentário também mostra o trecho
    const textos = pagina.flatMap((n) => (comTexto(n) ? [comentarioVisivel(n) ?? ''] : []));
    const nomes = await resolverMencoes(this.prisma, [...new Set([...visiveis.map(textoDe), ...textos].flatMap(extrairMencoes))]);
    const resumoDe = (p: (typeof visiveis)[number]) => curto(comNomes(textoDe(p), nomes));
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
          post: n.postId ? { id: n.postId, miniUrl: p?.images[0]?.thumbPath ?? p?.video?.capaPath ?? null, resumo: p ? resumoDe(p) : INDISPONIVEL } : null,
          votacao: n.votacao,
          ...(comTexto(n) && { comentario: n.comentario && { id: n.comentario.id, resumo: curto(comentarioVisivel(n) !== null ? comNomes(comentarioVisivel(n)!, nomes) : INDISPONIVEL_COMENTARIO) } }),
          // clube = o que ela queria assumir (null no pedido de sair); itens antigos sem pedido ligado ficam com troca null
          ...(n.tipo === 'TROCA_DECIDIDA' && { troca: n.troca && n.troca.status !== 'PENDENTE' ? { status: n.troca.status, clube: n.troca.club && { id: n.troca.club.id, nome: n.troca.club.name, escudoUrl: n.troca.club.crestPath } } : null }),
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

  /** Pessoas por pedaço do nome, sem acento e sem diferenciar maiúsculas; quem começa com o texto vem primeiro. `q` curto demais → vazio. */
  async pessoas(q: unknown, limite = PESSOAS_MAX, pular = 0) {
    const t = typeof q === 'string' ? q.trim().slice(0, 60) : '';
    if (t.length < 2) return [];
    const p = escaparLike(t);
    const achados = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM "User"
      WHERE lower(unaccent(name)) LIKE '%' || lower(unaccent(${p})) || '%'
      ORDER BY (lower(unaccent(name)) LIKE lower(unaccent(${p})) || '%') DESC, name ASC, id ASC
      LIMIT ${limite} OFFSET ${pular}`;
    const us = await this.prisma.user.findMany({ where: { id: { in: achados.map((a) => a.id) } }, include: { club: { select: { id: true, name: true, crestPath: true } } } });
    return achados.flatMap(({ id }) => us.filter((u) => u.id === id)).map((u) => ({ id: u.id, nome: u.name, avatarUrl: u.avatarPath, clube: u.club && { id: u.club.id, nome: u.club.name, escudoUrl: u.club.crestPath } }));
  }
}
