import { Body, Controller, HttpCode, Logger, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from '../auth/auth.service.js';
import { ipBucket, RateLimiter } from '../auth/rate-limit.js';
import { ApiError } from '../http.js';

const MAX = { mensagem: 500, pilha: 2000, url: 300, versao: 40 };
const corta = (v: unknown, n: number) => String(v).replace(/[\r\n\t]+/g, ' ').slice(0, n);
// a query pode ter token (/nova-senha?token=...): no log vai só o caminho; em texto livre, tudo depois de '?' vira '?…'
const semQuery = (v: string) => v.replace(/\?[^\s]*/g, '?…');
const soCaminho = (v: string) => v.split(/[?#]/)[0];

/** Erros do app no celular, direto no log do back (o docker gira o log). Público: o app pode quebrar antes do login. */
@Controller('erros-front')
export class ErrosController {
  private readonly logger = new Logger('erro-front');

  constructor(
    private readonly auth: AuthService,
    private readonly limiter: RateLimiter,
  ) {}

  @Post()
  @HttpCode(204)
  async registrar(@Req() req: Request, @Res({ passthrough: true }) res: Response, @Body() body: unknown) {
    const espera = this.limiter.check([[`erros-front:ip:${ipBucket(req.ip)}`, 30, 60_000]]);
    if (espera > 0) {
      res.setHeader('Retry-After', String(espera));
      throw new ApiError(429, 'MUITAS_TENTATIVAS', 'Muitos relatórios. Espere um pouco.');
    }
    const d = (typeof body === 'object' && body && !Array.isArray(body) ? body : {}) as Record<string, unknown>;
    const texto = (v: unknown) => typeof v === 'string';
    if (!texto(d.mensagem) || !d.mensagem || !texto(d.url) || !texto(d.versao) || (d.pilha !== undefined && !texto(d.pilha)))
      throw new ApiError(400, 'DADOS_INVALIDOS', 'Envie mensagem, url e versao (e pilha, se houver) como texto.');
    const userId = (await this.auth.buscarSessao(req))?.userId;
    // uma linha só (JSON): quebra de linha vinda do app não forja entrada de log
    this.logger.warn(
      'erro-front ' +
        JSON.stringify({ ...(userId && { userId }), mensagem: corta(semQuery(d.mensagem as string), MAX.mensagem), url: corta(soCaminho(d.url as string), MAX.url), versao: corta(d.versao, MAX.versao), ...(d.pilha !== undefined && { pilha: corta(semQuery(d.pilha as string), MAX.pilha) }) }),
    );
  }
}
