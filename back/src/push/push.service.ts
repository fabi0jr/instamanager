import { Injectable, Logger } from '@nestjs/common';
import webpush from 'web-push';
import { PrismaService } from '../prisma.service.js';

export type MensagemPush = { titulo: string; corpo: string; url: string };

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private pronto = false;
  private avisou = false;

  constructor(private readonly prisma: PrismaService) {}

  /** Configura o VAPID na primeira vez. Sem as três variáveis o push fica desligado (dev), sem derrubar nada. */
  private configurar(): boolean {
    const { VAPID_PUBLIC_KEY: pub, VAPID_PRIVATE_KEY: priv, VAPID_SUBJECT: assunto } = process.env;
    if (!pub || !priv || !assunto) {
      if (!this.avisou) this.logger.warn('VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY ou VAPID_SUBJECT ausente no .env: push desligado');
      this.avisou = true;
      return false;
    }
    if (!this.pronto) {
      webpush.setVapidDetails(assunto, pub, priv);
      this.pronto = true;
    }
    return true;
  }

  /** Envia para as inscrições de quem tem `pushEnabled`. Nunca lança: erro de um endpoint não afeta os outros. */
  async enviar(userIds: string[], msg: MensagemPush): Promise<void> {
    if (!userIds.length || !this.configurar()) return;
    const inscricoes = await this.prisma.pushSubscription.findMany({ where: { userId: { in: userIds }, user: { pushEnabled: true } } });
    const resultados = await Promise.allSettled(
      inscricoes.map((s) => webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(msg), { TTL: 86_400 })),
    );
    const vencidas: string[] = [];
    resultados.forEach((r, i) => {
      if (r.status === 'fulfilled') return;
      const status = (r.reason as { statusCode?: number })?.statusCode;
      // 404/410: o aparelho desinstalou ou revogou; a inscrição não volta mais
      if (status === 404 || status === 410) vencidas.push(inscricoes[i].id);
      else this.logger.warn(`falha ao enviar push (${status ?? 'sem status'}): ${String(r.reason)}`);
    });
    if (vencidas.length) await this.prisma.pushSubscription.deleteMany({ where: { id: { in: vencidas } } });
  }
}
