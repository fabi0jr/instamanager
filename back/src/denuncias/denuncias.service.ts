import { Injectable } from '@nestjs/common';
import type { UserComClube } from '../auth/auth.service.js';
import { ApiError } from '../http.js';
import { codificarCursor, decodificarCursor, UUID } from '../posts/cursor.js';
import { comentariosVisiveis, ondeVisivel } from '../posts/visibilidade.js';
import { PrismaService } from '../prisma.service.js';

const MOTIVO_MAX = 300;
const POR_PAGINA = 20;
const naoEncontrado = () => new ApiError(404, 'NAO_ENCONTRADO', 'Não encontramos o que você procurou.');
const invalido = (mensagem: string, campo: string) => new ApiError(400, 'DADOS_INVALIDOS', mensagem, [campo]);

@Injectable()
export class DenunciasService {
  constructor(private readonly prisma: PrismaService) {}

  /** `{postId}` ou `{commentId}` (um só), `motivo` opcional ≤ 300. Só dá para denunciar o que a pessoa enxerga. */
  async criar(user: UserComClube, corpo: unknown) {
    const c = typeof corpo === 'object' && corpo ? (corpo as Record<string, unknown>) : {};
    const [postId, commentId] = [c.postId, c.commentId];
    if ((postId === undefined) === (commentId === undefined)) throw invalido('Envie postId ou commentId (só um).', 'postId');
    if (c.motivo !== undefined && c.motivo !== null && (typeof c.motivo !== 'string' || c.motivo.length > MOTIVO_MAX)) throw invalido(`O motivo tem no máximo ${MOTIVO_MAX} caracteres.`, 'motivo');
    const motivo = typeof c.motivo === 'string' && c.motivo.trim() ? c.motivo.trim() : null;
    const visivel = ondeVisivel(user.id, user.isAdmin, { lista: false });
    if (postId !== undefined) {
      if (typeof postId !== 'string' || !UUID.test(postId) || !(await this.prisma.post.findFirst({ where: { id: postId, ...visivel }, select: { id: true } }))) throw naoEncontrado();
    } else if (typeof commentId !== 'string' || !UUID.test(commentId) || !(await this.prisma.comment.findFirst({ where: { id: commentId, ...comentariosVisiveis(user.isAdmin), post: visivel }, select: { id: true } }))) {
      throw naoEncontrado();
    }
    // a mesma pessoa não abre duas denúncias iguais: a repetida devolve a que já está aberta
    const aberta = await this.prisma.report.findFirst({ where: { userId: user.id, resolvidaEm: null, postId: (postId as string | undefined) ?? null, commentId: (commentId as string | undefined) ?? null }, select: { id: true } });
    if (aberta) return { id: aberta.id };
    const r = await this.prisma.report.create({
      data: { userId: user.id, postId: postId as string | undefined, commentId: commentId as string | undefined, motivo },
      select: { id: true },
    });
    return { id: r.id };
  }

  /** Pagina como o feed: cursor `criadoEm|id`, 20 por vez, das mais novas. */
  async listar(abertas: boolean, antes?: string) {
    const c = decodificarCursor(antes);
    const lista = await this.prisma.report.findMany({
      where: { ...(abertas && { resolvidaEm: null }), ...(c && { OR: [{ createdAt: { lt: c.criadoEm } }, { createdAt: c.criadoEm, id: { lt: c.id } }] }) },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: POR_PAGINA + 1,
      include: { user: { select: { id: true, name: true } }, post: { select: { id: true, caption: true, texto: true, clubId: true } }, comment: { select: { id: true, text: true, postId: true } } },
    });
    const pagina = lista.slice(0, POR_PAGINA);
    const ultima = pagina.at(-1);
    return {
      itens: pagina.map((r) => ({
        id: r.id,
        criadoEm: r.createdAt,
        motivo: r.motivo,
        resolvidaEm: r.resolvidaEm,
        denunciante: { id: r.user.id, nome: r.user.name },
        post: r.post && { id: r.post.id, legenda: r.post.caption, texto: r.post.texto, clubeId: r.post.clubId },
        comentario: r.comment && { id: r.comment.id, texto: r.comment.text, postId: r.comment.postId },
      })),
      proximo: lista.length > POR_PAGINA && ultima ? codificarCursor(ultima.createdAt, ultima.id) : null,
    };
  }

  async resolver(id: string) {
    if (!UUID.test(id) || !(await this.prisma.report.findUnique({ where: { id }, select: { id: true } }))) throw naoEncontrado();
    await this.prisma.report.updateMany({ where: { id, resolvidaEm: null }, data: { resolvidaEm: new Date() } });
  }
}
