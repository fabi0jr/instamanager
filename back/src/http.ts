import { resolve } from 'node:path';
import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { NextFunction, Request, Response } from 'express';

// Erro no formato do contrato (docs/api.md, "Convenções"): { codigo, mensagem, campos? }.
export class ApiError extends HttpException {
  constructor(status: number, codigo: string, mensagem: string, campos?: string[]) {
    super({ codigo, mensagem, ...(campos && { campos }) }, status);
  }
}

const PADRAO: Record<number, [string, string]> = {
  400: ['DADOS_INVALIDOS', 'Confira os dados enviados.'],
  404: ['NAO_ENCONTRADO', 'Não encontramos o que você procurou.'],
  413: ['ARQUIVO_GRANDE', 'O arquivo passou de 3 MB.'],
};
const logger = new Logger('API');
// o roteamento do Express não diferencia maiúsculas: /API/auth também cai nas rotas de /api
const ehApi = (req: Request) => req.path.toLowerCase().startsWith('/api');

function responderErro(erro: unknown, req: Request, res: Response) {
  // erros do body-parser (JSON inválido, corpo grande) não são HttpException, mas trazem status
  const status = erro instanceof HttpException ? erro.getStatus() : ((erro as { status?: number })?.status ?? 500);
  const corpo = erro instanceof HttpException ? erro.getResponse() : undefined;

  if (!ehApi(req)) {
    res.status(status).json(corpo ?? { statusCode: status });
  } else if (erro instanceof ApiError) {
    res.status(status).json(corpo);
  } else {
    if (status >= 500 || !PADRAO[status]) logger.error(erro);
    const [codigo, mensagem] = PADRAO[status] ?? ['ERRO_INTERNO', 'Algo deu errado do nosso lado. Tente de novo.'];
    res.status(PADRAO[status] ? status : 500).json({ codigo, mensagem });
  }
}

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(erro: unknown, host: ArgumentsHost) {
    const http = host.switchToHttp();
    responderErro(erro, http.getRequest<Request>(), http.getResponse<Response>());
  }
}

const MUDA_ESTADO = new Set(['POST', 'PUT', 'DELETE', 'PATCH']);

/** Regras de transporte (docs/api.md, "Convenções"); usado pelo main.ts e pelos testes e2e. */
export function configureApp(app: NestExpressApplication) {
  app.set('trust proxy', process.env.TRUST_PROXY === '1' ? 1 : false);
  app.useGlobalFilters(new ApiExceptionFilter());
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Referrer-Policy', 'no-referrer');
    if (!ehApi(req) || !MUDA_ESTADO.has(req.method)) return next();
    if (!process.env.APP_URL || req.headers.origin !== process.env.APP_URL)
      return next(new ApiError(403, 'ORIGEM_INVALIDA', 'Pedido recusado: origem não permitida.'));
    const temCorpo = Number(req.headers['content-length'] ?? 0) > 0 || req.headers['transfer-encoding'];
    if (temCorpo && !req.is(['application/json', 'multipart/form-data']))
      return next(new ApiError(400, 'DADOS_INVALIDOS', 'Envie os dados como JSON ou multipart.'));
    next();
  });
  // relatório de erro do app: corpo de até 4 KB, decidido pelo Content-Length antes de ler (o json global aceitaria 1 MB).
  // Sem Content-Length (chunked) também é recusado; o nginx e o fetch do navegador sempre mandam o tamanho.
  app.use('/api/erros-front', (req: Request, _res: Response, next: NextFunction) => {
    const len = req.headers['content-length'];
    if (req.headers['transfer-encoding'] || (len !== undefined && !(Number(len) <= 4096))) return next(new ApiError(413, 'CORPO_GRANDE', 'O relatório passou de 4 KB.'));
    next();
  });
  // depois do Origin: pedido de outra origem é recusado antes de ler o corpo
  app.useBodyParser('json', { limit: '1mb' });
  // erros dos middlewares do Express (Origin, JSON inválido, corpo grande) não passam pelo filtro do Nest
  app.use((erro: unknown, req: Request, res: Response, _next: NextFunction) => responderErro(erro, req, res));
}

/** Só em dev (NODE_ENV ≠ production): serve UPLOADS_DIR em /uploads, para o proxy do vite mostrar as fotos. Em produção quem serve é o nginx. */
export function servirUploadsEmDev(app: NestExpressApplication) {
  if (process.env.NODE_ENV === 'production') return;
  app.useStaticAssets(resolve(process.env.UPLOADS_DIR ?? './uploads'), { prefix: '/uploads', index: false });
}
