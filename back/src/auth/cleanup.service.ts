import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { apagarImagem } from '../posts/imagens.js';
import { PrismaService } from '../prisma.service.js';

const HORA_MS = 3_600_000;

@Injectable()
export class CleanupService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CleanupService.name);
  private timer?: NodeJS.Timeout;

  constructor(private readonly prisma: PrismaService) {}

  // roda uma vez no boot (story vencido não fica no disco se o back ficou parado) e depois a cada hora; unref para não segurar o processo
  onModuleInit() {
    void this.limpar();
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
      const acoesMcp = await this.prisma.mcpAcao.deleteMany({ where: { createdAt: { lt: new Date(agora.getTime() - 60 * 86_400_000) } } });
      // story vencido: apaga a linha e depois os arquivos (se a linha sumiu e o arquivo ficou, é só lixo; o contrário deixaria story sem mídia)
      const vencidos = await this.prisma.story.findMany({ where: { expiraEm: { lt: agora } }, select: { id: true, path: true, capaPath: true } });
      if (vencidos.length) {
        await this.prisma.story.deleteMany({ where: { id: { in: vencidos.map((s) => s.id) } } });
        await Promise.all(vencidos.flatMap((s) => [s.path, s.capaPath]).flatMap((p) => (p ? [apagarImagem(p)] : [])));
      }
      if (sessoes.count + links.count + velhas.count + acoesMcp.count + vencidos.length > 0) this.logger.log(`limpeza: ${sessoes.count} sessões, ${links.count} links, ${velhas.count} avisos, ${acoesMcp.count} ações MCP, ${vencidos.length} stories`);
    } catch (erro) {
      this.logger.warn(`limpeza falhou: ${String(erro)}`);
    }
  }
}
