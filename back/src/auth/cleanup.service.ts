import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';

const HORA_MS = 3_600_000;

@Injectable()
export class CleanupService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CleanupService.name);
  private timer?: NodeJS.Timeout;

  constructor(private readonly prisma: PrismaService) {}

  // sem rodar no boot; unref para não segurar o processo
  onModuleInit() {
    this.timer = setInterval(() => void this.limpar(), HORA_MS);
    this.timer.unref();
  }

  onModuleDestroy() {
    clearInterval(this.timer);
  }

  /** Apaga sessões e links de senha vencidos ou usados. Nunca lança. */
  async limpar(agora = new Date()) {
    try {
      const sessoes = await this.prisma.session.deleteMany({ where: { expiresAt: { lt: agora } } });
      const links = await this.prisma.passwordReset.deleteMany({ where: { OR: [{ expiresAt: { lt: agora } }, { usedAt: { not: null } }] } });
      const velhas = await this.prisma.notificacao.deleteMany({ where: { createdAt: { lt: new Date(agora.getTime() - 60 * 86_400_000) } } });
      if (sessoes.count + links.count + velhas.count > 0) this.logger.log(`limpeza: ${sessoes.count} sessões, ${links.count} links, ${velhas.count} avisos`);
    } catch (erro) {
      this.logger.warn(`limpeza falhou: ${String(erro)}`);
    }
  }
}
