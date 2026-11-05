import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { EventEmitter } from 'node:events';
import { InteracoesEventos } from '../interacoes/interacoes.eventos.js';
import { avisadosDaResposta } from '../interacoes/respostas.js';
import { PostsEventos } from '../posts/posts.eventos.js';
import { PrismaService } from '../prisma.service.js';
import { TrocasEventos } from '../trocas/trocas.eventos.js';
import { PushService } from './push.service.js';

/** Liga os eventos internos às mensagens de push. Roda solto: o envio nunca segura a resposta HTTP. */
@Injectable()
export class PushListeners implements OnModuleInit {
  private readonly logger = new Logger(PushListeners.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly push: PushService,
    private readonly posts: PostsEventos,
    private readonly interacoes: InteracoesEventos,
    private readonly trocas: TrocasEventos,
  ) {}

  onModuleInit() {
    this.ouvir(this.posts, 'posts.criado', (id) => this.postNovo(id));
    this.ouvir(this.interacoes, 'comentarios.criado', (id, alvoId) => this.comentario(id, alvoId));
    this.ouvir(this.trocas, 'trocas.pedida', (id) => this.trocaPedida(id));
    this.ouvir(this.trocas, 'trocas.decidida', (id) => this.trocaDecidida(id));
  }

  private ouvir(origem: EventEmitter, evento: string, tratar: (id: string, alvoId?: string) => Promise<void>) {
    origem.on(evento, (id: string, alvoId?: string) => void tratar(id, alvoId).catch((e: unknown) => this.logger.error(`${evento}: ${String(e)}`)));
  }

  private async postNovo(id: string) {
    const p = await this.prisma.post.findUnique({ where: { id }, include: { club: true, author: true } });
    if (!p) return;
    const todos = await this.prisma.user.findMany({ where: { id: { not: p.authorId } }, select: { id: true } });
    const msg = p.club.oficial ? { titulo: 'CBF', corpo: 'Novo comunicado da CBF', url: `/p/${p.id}` } : { titulo: p.club.name, corpo: `${p.author.name} postou`, url: `/p/${p.id}` };
    await this.push.enviar(todos.map((u) => u.id), msg, p.club.oficial ? 'cbf' : 'posts');
  }

  /** Resposta: quem recebe RESPOSTA (autor do raiz e do alvo) é avisado como "Nova resposta"; o técnico, se não for um deles, segue com "Novo comentário". */
  private async comentario(id: string, alvoId?: string) {
    const c = await this.prisma.comment.findUnique({ where: { id }, include: { user: true, post: { include: { club: true } } } });
    if (!c) return;
    const corpo = `${c.user.name}: ${c.text.slice(0, 80)}`;
    const url = `/p/${c.postId}`;
    const respondidos = await avisadosDaResposta(this.prisma, c, alvoId);
    await this.push.enviar(respondidos, { titulo: 'Nova resposta', corpo, url }, 'comentarios');
    const tecnico = c.post.club.coachId;
    if (tecnico && tecnico !== c.userId && !respondidos.includes(tecnico)) await this.push.enviar([tecnico], { titulo: 'Novo comentário', corpo, url }, 'comentarios');
  }

  private async trocaPedida(id: string) {
    const t = await this.prisma.transferRequest.findUnique({ where: { id }, include: { user: true, club: true } });
    if (!t) return;
    const admins = await this.prisma.user.findMany({ where: { isAdmin: true, id: { not: t.userId } }, select: { id: true } });
    const quer = t.kind === 'SAIR' ? 'sair do clube' : `assumir o ${t.club?.name ?? 'clube'}`;
    await this.push.enviar(admins.map((a) => a.id), { titulo: 'Pedido de troca', corpo: `${t.user.name} quer ${quer}`, url: '/admin' }, 'trocas');
  }

  private async trocaDecidida(id: string) {
    const t = await this.prisma.transferRequest.findUnique({ where: { id }, include: { club: true } });
    if (!t || t.status === 'PENDENTE') return;
    const aprovada = t.status === 'APROVADA';
    const corpo = !aprovada ? 'O admin recusou o seu pedido' : t.kind === 'SAIR' ? 'Você saiu do clube' : `Você agora é o técnico do ${t.club?.name ?? 'clube'}`;
    await this.push.enviar([t.userId], { titulo: aprovada ? 'Troca aprovada' : 'Troca recusada', corpo, url: '/perfil' }, 'trocas');
  }
}
