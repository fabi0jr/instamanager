import { Body, Controller, Delete, Get, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import { type AuthedRequest, SessionGuard } from '../auth/session.guard.js';
import { ApiError } from '../http.js';
import { PrismaService } from '../prisma.service.js';

const invalido = (campo: string) => new ApiError(400, 'DADOS_INVALIDOS', 'Confira os dados da inscrição.', [campo]);

// O servidor faz POST nesse endereço, então só vale https em serviço de push conhecido (allowlist):
// FCM (Chrome/Android/Brave/Samsung), Mozilla (Firefox), Apple (Safari/iOS) e Windows (Edge). Fecha SSRF de vez:
// localhost, IP, rede interna e hostname com ponto final ("fcm.googleapis.com.") não passam.
// shortcut: navegador novo com outro serviço de push precisa entrar aqui; ver o erro 400 no front e acrescentar.
const SERVICOS_EXATOS = new Set(['fcm.googleapis.com', 'updates.push.services.mozilla.com', 'web.push.apple.com']);
const SERVICOS_SUFIXO = ['.notify.windows.com', '.push.services.mozilla.com'];

function lerEndpoint(v: unknown): string {
  if (typeof v !== 'string' || v.length > 2048) throw invalido('endpoint');
  let u: URL;
  try {
    u = new URL(v);
  } catch {
    throw invalido('endpoint');
  }
  const host = u.hostname.toLowerCase();
  const permitido = SERVICOS_EXATOS.has(host) || SERVICOS_SUFIXO.some((s) => host.endsWith(s));
  if (u.protocol !== 'https:' || u.port || u.username || u.password || !permitido) throw invalido('endpoint');
  return v;
}

const lerChave = (v: unknown, campo: string) => {
  if (typeof v !== 'string' || !v || v.length > 512) throw invalido(campo);
  return v;
};

@Controller('push')
@UseGuards(SessionGuard)
export class PushController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('chave')
  chave() {
    const chave = process.env.VAPID_PUBLIC_KEY;
    if (!chave) throw new ApiError(503, 'PUSH_INDISPONIVEL', 'Notificações indisponíveis no momento.');
    return { chave };
  }

  @Post('inscricao')
  @HttpCode(204)
  async inscrever(@Req() req: AuthedRequest, @Body() body: unknown) {
    const b = (typeof body === 'object' && body ? body : {}) as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
    const endpoint = lerEndpoint(b.endpoint);
    const p256dh = lerChave(b.keys?.p256dh, 'keys.p256dh');
    const auth = lerChave(b.keys?.auth, 'keys.auth');
    // upsert por endpoint: o aparelho é a identidade; se outra pessoa entrar nele, a inscrição passa para ela
    await this.prisma.pushSubscription.upsert({ where: { endpoint }, update: { userId: req.user.id, p256dh, auth }, create: { userId: req.user.id, endpoint, p256dh, auth } });
  }

  @Delete('inscricao')
  @HttpCode(204)
  async cancelar(@Req() req: AuthedRequest, @Body() body: unknown) {
    const endpoint = (typeof body === 'object' && body ? (body as { endpoint?: unknown }).endpoint : undefined);
    if (typeof endpoint !== 'string' || !endpoint) throw invalido('endpoint');
    await this.prisma.pushSubscription.deleteMany({ where: { endpoint, userId: req.user.id } });
  }
}
