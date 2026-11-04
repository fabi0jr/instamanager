import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { EventEmitter } from 'node:events';
import { InteracoesEventos } from '../interacoes/interacoes.eventos.js';
import { PostsEventos } from '../posts/posts.eventos.js';
import { PrismaService } from '../prisma.service.js';
import { TrocasEventos } from '../trocas/trocas.eventos.js';
import { AtividadeService } from './atividade.service.js';

/** Grava a atividade nos mesmos eventos que já disparam o push (o push continua com o PushListeners). Nunca segura a resposta HTTP. */
@Injectable()
export class AtividadeListeners implements OnModuleInit {
  private readonly logger = new Logger(AtividadeListeners.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly atividade: AtividadeService,
    private readonly posts: PostsEventos,
    private readonly interacoes: InteracoesEventos,
    private readonly trocas: TrocasEventos,
  ) {}

  onModuleInit() {
    this.ouvir(this.interacoes, 'reacoes.reagida', (postId: string, userId: string) => this.atividade.reacao(postId, userId));
    this.ouvir(this.interacoes, 'comentarios.criado', (id: string) => this.atividade.comentario(id));
    this.ouvir(this.posts, 'posts.criado', (id: string) => this.postTexto(id));
    this.ouvir(this.posts, 'posts.editado', (id: string) => this.postTexto(id));
    this.ouvir(this.trocas, 'trocas.decidida', (id: string) => this.trocaDecidida(id));
  }

  private ouvir(origem: EventEmitter, evento: string, tratar: (...args: string[]) => Promise<void>) {
    origem.on(evento, (...args: string[]) => void tratar(...args).catch((e: unknown) => this.logger.error(`${evento}: ${String(e)}`)));
  }

  private async postTexto(id: string) {
    const p = await this.prisma.post.findUnique({ where: { id }, select: { authorId: true, caption: true, texto: true } });
    if (p) await this.atividade.mencionar(`${p.caption}\n${p.texto ?? ''}`, p.authorId, id);
  }

  private async trocaDecidida(id: string) {
    const t = await this.prisma.transferRequest.findUnique({ where: { id }, select: { userId: true, status: true } });
    if (t && t.status !== 'PENDENTE') await this.atividade.criar([t.userId], 'TROCA_DECIDIDA');
  }
}
