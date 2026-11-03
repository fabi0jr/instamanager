import { Body, Controller, Get, HttpCode, Patch, Post, Put, Req, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request, Response } from 'express';
import { ApiError } from '../http.js';
import { AuthService, toMe } from './auth.service.js';
import { parseCadastro, parseEmail, parseEntrar, parsePerfil, parseRedefinir } from './auth.validation.js';
import { ipBucket, type Limite, RateLimiter } from './rate-limit.js';
import { type AuthedRequest, SessionGuard } from './session.guard.js';

const MIN = 60_000;
const HORA = 60 * MIN;

/** Estoura o limite → 429 com Retry-After. */
function limitar(limiter: RateLimiter, res: Response, limites: Limite[]) {
  const espera = limiter.check(limites);
  if (espera > 0) {
    res.setHeader('Retry-After', String(espera));
    throw new ApiError(429, 'MUITAS_TENTATIVAS', 'Muitas tentativas. Espere um pouco e tente de novo.');
  }
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly limiter: RateLimiter,
  ) {}

  @Post('cadastro')
  async cadastro(@Body() body: unknown, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const d = parseCadastro(body);
    limitar(this.limiter, res, [
      [`cadastro:ip:${ipBucket(req.ip)}`, 20, HORA],
      [`cadastro:email:${d.email}`, 5, HORA],
    ]);
    const user = await this.auth.cadastrar(d);
    await this.auth.criarSessao(user.id, res);
    return toMe(user);
  }

  @Post('entrar')
  @HttpCode(200)
  async entrar(@Body() body: unknown, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const { email, senha } = parseEntrar(body);
    limitar(this.limiter, res, [
      [`entrar:ip:${ipBucket(req.ip)}`, 30, 15 * MIN],
      // espaço separa e-mail e IP: e-mail válido não tem espaço
      [`entrar:email-ip:${email} ${ipBucket(req.ip)}`, 10, 15 * MIN],
      // por conta, qualquer IP: segura quem tenta a mesma senha de vários IPs
      [`entrar:email:${email}`, 20, HORA],
    ]);
    const user = await this.auth.entrar(email, senha);
    // acertou a senha: zera os contadores dessa conta
    this.limiter.esquecer(`entrar:email-ip:${email} `);
    this.limiter.apagar(`entrar:email:${email}`);
    await this.auth.criarSessao(user.id, res);
    return toMe(user);
  }

  @Post('sair')
  @HttpCode(204)
  async sair(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.auth.sair(req, res);
  }

  @Post('esqueci')
  @HttpCode(204)
  esqueci(@Body() body: unknown, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const email = parseEmail(body);
    limitar(this.limiter, res, [
      [`esqueci:ip:${ipBucket(req.ip)}`, 10, HORA],
      [`esqueci:email:${email}`, 3, HORA],
    ]);
    this.auth.esqueci(email);
  }

  @Post('redefinir')
  @HttpCode(204)
  async redefinir(@Body() body: unknown, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const { token, senha } = parseRedefinir(body);
    limitar(this.limiter, res, [[`redefinir:ip:${ipBucket(req.ip)}`, 20, HORA]]);
    await this.auth.redefinir(token, senha);
  }
}

@Controller('me')
@UseGuards(SessionGuard)
export class MeController {
  constructor(
    private readonly auth: AuthService,
    private readonly limiter: RateLimiter,
  ) {}

  @Get()
  me(@Req() req: AuthedRequest) {
    return toMe(req.user);
  }

  @Patch()
  async atualizar(@Body() body: unknown, @Req() req: AuthedRequest, @Res({ passthrough: true }) res: Response) {
    const dados = parsePerfil(body);
    // a senhaAtual é um palpite de senha: 5 por 15 min por conta, zera quando acerta
    const chave = `perfil-senha:user:${req.user.id}`;
    if (dados.senhaNova) limitar(this.limiter, res, [[chave, 5, 15 * MIN]]);
    const me = toMe(await this.auth.atualizarPerfil(req.user, req.sessao.id, dados));
    this.limiter.apagar(chave);
    return me;
  }

  // limite do multer (3 MB) vira 413 pelo Nest
  @Put('foto')
  @UseInterceptors(FileInterceptor('foto', { limits: { fileSize: 3 * 1024 * 1024 } }))
  async foto(@UploadedFile() arquivo: { buffer: Buffer } | undefined, @Req() req: AuthedRequest) {
    return toMe(await this.auth.trocarFoto(req.user, arquivo?.buffer));
  }
}
