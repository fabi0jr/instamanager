import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { EventEmitter } from 'node:events';
import { CopaEventos } from '../copa/copa.eventos.js';
import { LigaEventos } from '../liga/liga.eventos.js';
import { PostsEventos } from '../posts/posts.eventos.js';
import { PrismaService } from '../prisma.service.js';
import { StoriesEventos } from '../stories/stories.eventos.js';
import { VotacoesEventos } from '../votacoes/votacoes.eventos.js';
import { ConquistasService, SEMEADA } from './conquistas.service.js';

/** Recalcula as conquistas nos eventos que já existem. Nunca segura a resposta HTTP. */
@Injectable()
export class ConquistasListeners implements OnModuleInit {
  private readonly logger = new Logger(ConquistasListeners.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly conquistas: ConquistasService,
    private readonly liga: LigaEventos,
    private readonly copa: CopaEventos,
    private readonly posts: PostsEventos,
    private readonly stories: StoriesEventos,
    private readonly votacoes: VotacoesEventos,
  ) {}

  async onModuleInit() {
    this.ouvir(this.liga, 'liga.rodadaFechada', () => this.conquistas.verificar());
    this.ouvir(this.copa, 'copa.faseFechada', () => this.conquistas.verificar());
    this.ouvir(this.votacoes, 'votacoes.encerrada', () => this.conquistas.verificar());
    this.ouvir(this.posts, 'posts.criado', async (id) => this.doAutor((await this.prisma.post.findUnique({ where: { id }, select: { authorId: true } }))?.authorId));
    this.ouvir(this.stories, 'stories.criado', async (id) => this.doAutor((await this.prisma.story.findUnique({ where: { id }, select: { autorId: true } }))?.autorId));
    // primeira vez no ar: grava o histórico em silêncio (o `verificar` também grava a marca)
    if (!(await this.prisma.setting.findUnique({ where: { key: SEMEADA } }))) await this.conquistas.verificar();
  }

  private doAutor(id?: string | null) {
    return id ? this.conquistas.verificar([id]) : undefined;
  }

  private ouvir(origem: EventEmitter, evento: string, tratar: (id: string) => Promise<unknown> | undefined) {
    origem.on(evento, (id: string) => void Promise.resolve(tratar(id)).catch((e: unknown) => this.logger.error(`${evento}: ${String(e)}`)));
  }
}
