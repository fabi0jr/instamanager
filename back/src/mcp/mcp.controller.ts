import { Controller, Delete, Get, Post, Req, Res } from '@nestjs/common';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { Request, Response } from 'express';
import { ipBucket, RateLimiter } from '../auth/rate-limit.js';
import { chaveConfere } from './chave.js';
import { McpService } from './mcp.service.js';

const MIN = 60_000;
const erroRpc = (
  res: Response,
  status: number,
  code: number,
  message: string,
) =>
  res
    .status(status)
    .json({ jsonrpc: '2.0', error: { code, message }, id: null });

/** `POST /mcp`: fora do /api e do filtro de Origin; quem protege é a chave Bearer (MCP_CHAVE). Sem a chave no ambiente, o endpoint não existe (404). */
@Controller('mcp')
export class McpController {
  constructor(
    private readonly mcp: McpService,
    private readonly limiter: RateLimiter,
  ) {}

  @Post()
  async pedido(@Req() req: Request, @Res() res: Response) {
    if (!process.env.MCP_CHAVE)
      return res.status(404).json({ statusCode: 404 });
    // mesmo limite do login por IP; acertar a chave zera o contador
    const ip = `mcp:ip:${ipBucket(req.ip)}`;
    const espera = this.limiter.check([[ip, 30, 15 * MIN]]);
    if (espera > 0) {
      res.setHeader('Retry-After', String(espera));
      return erroRpc(
        res,
        429,
        -32002,
        'Muitas tentativas. Espere um pouco e tente de novo.',
      );
    }
    if (!chaveConfere(req.headers.authorization))
      return erroRpc(res, 401, -32001, 'Chave inválida.');
    this.limiter.apagar(ip);

    const server = this.mcp.criarServidor();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    res.on('close', () => void transport.close().then(() => server.close()));
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  }

  // modo sem sessão: não há stream de servidor nem sessão para encerrar
  @Get()
  get(@Res() res: Response) {
    return this.naoPermitido(res);
  }

  @Delete()
  apagar(@Res() res: Response) {
    return this.naoPermitido(res);
  }

  private naoPermitido(@Res() res: Response) {
    if (!process.env.MCP_CHAVE)
      return res.status(404).json({ statusCode: 404 });
    res.setHeader('Allow', 'POST');
    return erroRpc(res, 405, -32000, 'Método não permitido.');
  }
}
