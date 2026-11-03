import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { EventEmitter } from 'node:events';
import { InteracoesEventos } from '../interacoes/interacoes.eventos.js';
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
    this.ouvir(this.interacoes, 'comentarios.criado', (id) => this.comentario(id));
    this.ouvir(this.trocas, 'trocas.pedida', (id) => this.trocaPedida(id));
    this.ouvir(this.trocas, 'trocas.decidida', (id) => this.trocaDecidida(id));
  }

  private ouvir(origem: EventEmitter, evento: string, tratar: (id: string) => Promise<void>) {
    origem.on(evento, (id: string) => void tratar(id).catch((e: unknown) => this.logger.error(`${evento}: ${String(e)}`)));
  }

  private async postNovo(id: string) {
    const p = await this.prisma.post.findUnique({ where: { id }, include: { club: true, author: true } });
    if (!p) return;
    const todos = await this.prisma.user.findMany({ where: { id: { not: p.authorId } }, select: { id: true } });
    await this.push.enviar(todos.map((u) => u.id), { titulo: p.club.name, corpo: `${p.author.name} postou`, url: `/p/${p.id}` });
  }

  private async comentario(id: string) {
    const c = await this.prisma.comment.findUnique({ where: { id }, include: { user: true, post: { include: { club: true } } } });
    const tecnico = c?.post.club.coachId;
    if (!c || !tecnico || tecnico === c.userId) return;
    await this.push.enviar([tecnico], { titulo: 'Novo comentário', corpo: `${c.user.name}: ${c.text.slice(0, 80)}`, url: `/p/${c.postId}` });
  }

  private async trocaPedida(id: string) {
    const t = await this.prisma.transferRequest.findUnique({ where: { id }, include: { user: true, club: true } });
    if (!t) return;
    const admins = await this.prisma.user.findMany({ where: { isAdmin: true, id: { not: t.userId } }, select: { id: true } });
    const quer = t.kind === 'SAIR' ? 'sair do clube' : `assumir o ${t.club?.name ?? 'clube'}`;
    await this.push.enviar(admins.map((a) => a.id), { titulo: 'Pedido de troca', corpo: `${t.user.name} quer ${quer}`, url: '/admin' });
  }

  private async trocaDecidida(id: string) {
    const t = await this.prisma.transferRequest.findUnique({ where: { id }, include: { club: true } });
    if (!t || t.status === 'PENDENTE') return;
    const aprovada = t.status === 'APROVADA';
    const corpo = !aprovada ? 'O admin recusou o seu pedido' : t.kind === 'SAIR' ? 'Você saiu do clube' : `Você agora é o técnico do ${t.club?.name ?? 'clube'}`;
    await this.push.enviar([t.userId], { titulo: aprovada ? 'Troca aprovada' : 'Troca recusada', corpo, url: '/perfil' });
  }
}
