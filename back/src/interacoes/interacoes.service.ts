import { Injectable } from '@nestjs/common';
import type { UserComClube } from '../auth/auth.service.js';
import { ApiError } from '../http.js';
import { UUID } from '../posts/cursor.js';
import { PrismaService } from '../prisma.service.js';
import { InteracoesEventos } from './interacoes.eventos.js';

const TEXTO_MAX = 1000;
const naoEncontrado = () => new ApiError(404, 'NAO_ENCONTRADO', 'Não encontramos o que você procurou.');

type ComentarioCompleto = {
  id: string;
  text: string;
  createdAt: Date;
  user: { id: string; name: string; avatarPath: string | null; club: { id: string; name: string } | null };
};
const comUsuario = { user: { select: { id: true, name: true, avatarPath: true, club: { select: { id: true, name: true } } } } } as const;

const comentarioJson = (c: ComentarioCompleto) => ({
  id: c.id,
  texto: c.text,
  criadoEm: c.createdAt,
  // a tag é o clube de hoje de quem comentou, não o de quando comentou
  usuario: { id: c.user.id, nome: c.user.name, avatarUrl: c.user.avatarPath, clube: c.user.club && { id: c.user.club.id, nome: c.user.club.name } },
});

@Injectable()
export class InteracoesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventos: InteracoesEventos,
  ) {}

  private async garantirPost(id: string) {
    if (!UUID.test(id) || !(await this.prisma.post.findUnique({ where: { id }, select: { id: true } }))) throw naoEncontrado();
  }

  async curtir(postId: string, user: UserComClube) {
    await this.garantirPost(postId);
    // skipDuplicates: curtir de novo (ou duas vezes ao mesmo tempo) não falha nem duplica
    await this.prisma.like.createMany({ data: [{ postId, userId: user.id }], skipDuplicates: true });
  }

  async descurtir(postId: string, user: UserComClube) {
    await this.garantirPost(postId);
    await this.prisma.like.deleteMany({ where: { postId, userId: user.id } });
  }

  async listar(postId: string) {
    await this.garantirPost(postId);
    const lista = await this.prisma.comment.findMany({ where: { postId }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], include: comUsuario });
    return lista.map(comentarioJson);
  }

  async comentar(postId: string, user: UserComClube, corpo: unknown) {
    const bruto = typeof corpo === 'object' && corpo ? (corpo as { texto?: unknown }).texto : undefined;
    const texto = typeof bruto === 'string' ? bruto.trim() : '';
    if (!texto || texto.length > TEXTO_MAX) throw new ApiError(400, 'DADOS_INVALIDOS', `O comentário precisa ter de 1 a ${TEXTO_MAX} caracteres.`, ['texto']);
    await this.garantirPost(postId);
    const c = await this.prisma.comment.create({ data: { postId, userId: user.id, text: texto }, include: comUsuario });
    this.eventos.emit('comentarios.criado', c.id);
    return comentarioJson(c);
  }

  async apagar(id: string, user: UserComClube) {
    const c = UUID.test(id) ? await this.prisma.comment.findUnique({ where: { id }, select: { userId: true } }) : null;
    if (!c) throw naoEncontrado();
    if (c.userId !== user.id && !user.isAdmin) throw new ApiError(403, 'NAO_E_AUTOR', 'Só quem comentou (ou o admin) apaga o comentário.');
    await this.prisma.comment.deleteMany({ where: { id } }); // deleteMany: apagar duas vezes ao mesmo tempo não explode
  }
}
