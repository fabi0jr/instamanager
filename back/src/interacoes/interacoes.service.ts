import { Injectable } from '@nestjs/common';
import type { UserComClube } from '../auth/auth.service.js';
import { ApiError } from '../http.js';
import { UUID } from '../posts/cursor.js';
import { comentariosVisiveis, ondeVisivel } from '../posts/visibilidade.js';
import { PrismaService } from '../prisma.service.js';
import { InteracoesEventos } from './interacoes.eventos.js';

const TEXTO_MAX = 1000;
export const EMOJIS = ['❤️', '🔥', '😂', '😮', '😢', '👏'];
const CORACAO = EMOJIS[0];
const naoEncontrado = () => new ApiError(404, 'NAO_ENCONTRADO', 'Não encontramos o que você procurou.');

type ComentarioCompleto = {
  id: string;
  text: string;
  createdAt: Date;
  hiddenAt: Date | null;
  user: { id: string; name: string; avatarPath: string | null; club: { id: string; name: string } | null };
};
const comUsuario = { user: { select: { id: true, name: true, avatarPath: true, club: { select: { id: true, name: true } } } } } as const;

const comentarioJson = (c: ComentarioCompleto) => ({
  id: c.id,
  texto: c.text,
  criadoEm: c.createdAt,
  oculto: c.hiddenAt !== null,
  // a tag é o clube de hoje de quem comentou, não o de quando comentou
  usuario: { id: c.user.id, nome: c.user.name, avatarUrl: c.user.avatarPath, clube: c.user.club && { id: c.user.club.id, nome: c.user.club.name } },
});

@Injectable()
export class InteracoesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventos: InteracoesEventos,
  ) {}

  /** Post oculto pelo admin é 404 para quem não é admin, em reação e comentário também. */
  private async garantirPost(id: string, user: UserComClube) {
    if (!UUID.test(id) || !(await this.prisma.post.findFirst({ where: { id, ...ondeVisivel(user.id, user.isAdmin, { lista: false }) }, select: { id: true } }))) throw naoEncontrado();
  }

  /** Uma reação por pessoa por post: reagir de novo troca o emoji. */
  async reagir(postId: string, user: UserComClube, emoji: unknown) {
    const e = emoji === '\u2764' ? CORACAO : emoji; // ❤ sem o seletor de variação também vale
    if (typeof e !== 'string' || !EMOJIS.includes(e)) throw new ApiError(400, 'EMOJI_INVALIDO', `Use um destes emojis: ${EMOJIS.join(' ')}`, ['emoji']);
    await this.garantirPost(postId, user);
    await this.prisma.like.upsert({ where: { postId_userId: { postId, userId: user.id } }, update: { emoji: e }, create: { postId, userId: user.id, emoji: e } });
  }

  /** Curtida da v1 = reação ❤️. */
  curtir(postId: string, user: UserComClube) {
    return this.reagir(postId, user, CORACAO);
  }

  async descurtir(postId: string, user: UserComClube) {
    await this.garantirPost(postId, user);
    await this.prisma.like.deleteMany({ where: { postId, userId: user.id } });
  }

  /** Quem reagiu, por emoji (o mais usado primeiro; empate por emoji). Mesma visibilidade do post. */
  async reacoes(postId: string, user: UserComClube) {
    await this.garantirPost(postId, user);
    const likes = await this.prisma.like.findMany({
      where: { postId },
      include: { user: { select: { id: true, name: true, avatarPath: true, club: { select: { id: true, name: true, crestPath: true } } } } },
      orderBy: { userId: 'asc' }, // sem data na reação: ordem estável por id
    });
    const grupos = new Map<string, unknown[]>();
    for (const l of likes) {
      const u = l.user;
      const item = { id: u.id, nome: u.name, avatarUrl: u.avatarPath, clube: u.club && { id: u.club.id, nome: u.club.name, escudoUrl: u.club.crestPath } };
      grupos.set(l.emoji, [...(grupos.get(l.emoji) ?? []), item]);
    }
    return [...grupos].map(([emoji, usuarios]) => ({ emoji, usuarios })).sort((a, b) => b.usuarios.length - a.usuarios.length || a.emoji.localeCompare(b.emoji));
  }

  async listar(postId: string, user: UserComClube) {
    await this.garantirPost(postId, user);
    const lista = await this.prisma.comment.findMany({ where: { postId, ...comentariosVisiveis(user.isAdmin) }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], include: comUsuario });
    return lista.map(comentarioJson);
  }

  async comentar(postId: string, user: UserComClube, corpo: unknown) {
    const bruto = typeof corpo === 'object' && corpo ? (corpo as { texto?: unknown }).texto : undefined;
    const texto = typeof bruto === 'string' ? bruto.trim() : '';
    if (!texto || texto.length > TEXTO_MAX) throw new ApiError(400, 'DADOS_INVALIDOS', `O comentário precisa ter de 1 a ${TEXTO_MAX} caracteres.`, ['texto']);
    await this.garantirPost(postId, user);
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

  /** Admin: oculta/mostra o comentário (reversível). */
  async ocultar(id: string, oculto: boolean) {
    if (!UUID.test(id) || !(await this.prisma.comment.findUnique({ where: { id }, select: { id: true } }))) throw naoEncontrado();
    await this.prisma.comment.updateMany({ where: { id }, data: { hiddenAt: oculto ? new Date() : null } });
  }
}
