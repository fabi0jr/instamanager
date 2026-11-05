import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma.service.js';
import { PushService } from '../push/push.service.js';

const MINUTO_MS = 60_000;
const ANTECEDENCIA_MS = 2 * 3_600_000;

/** Push 2 h antes do prazo, uma vez só, para quem ainda não palpitou todos os jogos daquele prazo. */
@Injectable()
export class LembreteService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(LembreteService.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly push: PushService,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => void this.lembrar(), MINUTO_MS);
    this.timer.unref();
  }

  onModuleDestroy() {
    clearInterval(this.timer);
  }

  /** Nunca lança. Quem perdeu o prazo mexido (refId leva o prazo) ganha lembrete novo. */
  async lembrar(agora = new Date()) {
    try {
      const ate = new Date(agora.getTime() + ANTECEDENCIA_MS);
      const janela = { gt: agora, lte: ate };
      const [rodadas, fases] = await Promise.all([
        this.prisma.rodada.findMany({ where: { prazoPalpite: janela, fechadaEm: null }, include: { jogos: { select: { id: true } } } }),
        this.prisma.copaFase.findMany({ where: { prazoPalpite: janela, fechadaEm: null }, include: { jogos: { select: { id: true } } } }),
      ]);
      for (const r of rodadas) await this.avisar('RODADA', `${r.numero}@${r.prazoPalpite!.toISOString()}`, `Rodada ${r.numero}`, r.jogos.map((j) => j.id), 'jogoId', `/liga?aba=bolao`);
      for (const f of fases) await this.avisar('FASE', `${f.id}@${f.prazoPalpite!.toISOString()}`, f.nome, f.jogos.map((j) => j.id), 'copaJogoId', `/liga?aba=bolao`);
    } catch (e) {
      this.logger.warn(`lembrete do bolão: ${String(e)}`);
    }
  }

  private async avisar(tipo: string, refId: string, nome: string, jogoIds: string[], campo: 'jogoId' | 'copaJogoId', url: string) {
    if (!jogoIds.length) return;
    try {
      await this.prisma.lembreteEnviado.create({ data: { tipo, refId } }); // a chave composta garante o "uma vez só"
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return;
      throw e;
    }
    const feitos = await this.prisma.palpite.groupBy({ by: ['userId'], where: { [campo]: { in: jogoIds } }, _count: { _all: true } });
    const completos = new Set(feitos.filter((f) => f._count._all >= jogoIds.length).map((f) => f.userId));
    const todos = await this.prisma.user.findMany({ select: { id: true } });
    const faltam = todos.map((u) => u.id).filter((id) => !completos.has(id));
    await this.push.enviar(faltam, { titulo: 'Bolão', corpo: `${nome}: faltam palpites, o prazo acaba em 2 h`, url }, 'bolao');
  }
}
