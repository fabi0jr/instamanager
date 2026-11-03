import { Injectable, Logger } from '@nestjs/common';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

// Envio pelo Resend via fetch (sem SDK). Chave só no .env; lida a cada envio.
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  async enviarRecuperacao(para: string, nome: string, token: string) {
    const link = `${process.env.APP_URL}/nova-senha?token=${token}`;
    const text = `Oi, ${nome}! Para criar uma senha nova no InstaManager, abra o link (vale 1 hora):\n${link}\n\nSe não foi você, ignore este e-mail.`;
    const html = `<p>Oi, ${esc(nome)}!</p><p><a href="${esc(link)}">Criar uma senha nova</a> (vale 1 hora)</p><p>Se não foi você, ignore este e-mail.</p>`;
    await this.enviar(para, { subject: 'Senha nova no InstaManager', html, text }, link);
  }

  private async enviar(to: string, email: { subject: string; html: string; text: string }, link: string) {
    const chave = process.env.RESEND_API_KEY;
    const from = process.env.MAIL_FROM;
    // Dev sem chave: o link vai para o log. Só com ambiente declarado (o link vale como senha).
    if (!chave && ['development', 'test'].includes(process.env.NODE_ENV ?? '')) this.logger.log(`[dev] e-mail "${email.subject}" para ${to}: ${link}`);
    if (!chave || !from) return;
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${chave}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [to], ...email }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`Resend respondeu ${res.status}: ${await res.text()}`);
  }
}
