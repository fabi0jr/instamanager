import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import type { Session } from '../generated/prisma/client.js';
import { ApiError } from '../http.js';
import { AuthService, type UserComClube } from './auth.service.js';

export type AuthedRequest = Request & { user: UserComClube; sessao: Session };

/** Rotas 🔒: sem sessão válida → 401 NAO_AUTENTICADO. Põe req.user (com o clube) e req.sessao. */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const sessao = await this.auth.buscarSessao(req);
    if (!sessao) throw new ApiError(401, 'NAO_AUTENTICADO', 'Entre na sua conta para continuar.');
    req.user = sessao.user;
    req.sessao = sessao;
    return true;
  }
}

/** Rotas 👑: usar depois do SessionGuard — @UseGuards(SessionGuard, AdminGuard). */
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(ctx: ExecutionContext) {
    if (!ctx.switchToHttp().getRequest<AuthedRequest>().user?.isAdmin)
      throw new ApiError(403, 'NAO_E_ADMIN', 'Só o admin pode fazer isso.');
    return true;
  }
}
