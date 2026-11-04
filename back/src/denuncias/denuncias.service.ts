import { Injectable } from '@nestjs/common';
import type { UserComClube } from '../auth/auth.service.js';
import { ApiError } from '../http.js';
import { UUID } from '../posts/cursor.js';
import { comentariosVisiveis, ondeVisivel } from '../posts/visibilidade.js';
import { PrismaService } from '../prisma.service.js';

const MOTIVO_MAX = 300;
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
    const r = await this.prisma.report.create({
      data: { userId: user.id, postId: postId as string | undefined, commentId: commentId as string | undefined, motivo },
      select: { id: true },
    });
    return { id: r.id };
  }

  async listar(abertas: boolean) {
    const lista = await this.prisma.report.findMany({
      where: abertas ? { resolvidaEm: null } : {},
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: { user: { select: { id: true, name: true } }, post: { select: { id: true, caption: true, texto: true, clubId: true } }, comment: { select: { id: true, text: true, postId: true } } },
    });
    return lista.map((r) => ({
      id: r.id,
      criadoEm: r.createdAt,
      motivo: r.motivo,
      resolvidaEm: r.resolvidaEm,
      denunciante: { id: r.user.id, nome: r.user.name },
      post: r.post && { id: r.post.id, legenda: r.post.caption, texto: r.post.texto, clubeId: r.post.clubId },
      comentario: r.comment && { id: r.comment.id, texto: r.comment.text, postId: r.comment.postId },
    }));
  }

  async resolver(id: string) {
    if (!UUID.test(id) || !(await this.prisma.report.findUnique({ where: { id }, select: { id: true } }))) throw naoEncontrado();
    await this.prisma.report.updateMany({ where: { id, resolvidaEm: null }, data: { resolvidaEm: new Date() } });
  }
}
