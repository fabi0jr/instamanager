import { Controller, Get, HttpCode, Post, Query, Req, UseGuards } from '@nestjs/common';
import { type AuthedRequest, SessionGuard } from '../auth/session.guard.js';
import { AtividadeService } from './atividade.service.js';

@Controller('atividade')
@UseGuards(SessionGuard)
export class AtividadeController {
  constructor(private readonly atividade: AtividadeService) {}

  @Get()
  listar(@Req() req: AuthedRequest, @Query('antes') antes?: string) {
    return this.atividade.listar(req.user, antes);
  }

  @Get('nao-lidas')
  naoLidas(@Req() req: AuthedRequest) {
    return this.atividade.naoLidas(req.user.id);
  }

  @Post('lidas')
  @HttpCode(204)
  async lidas(@Req() req: AuthedRequest) {
    await this.atividade.marcarLidas(req.user.id);
  }
}

@Controller('pessoas')
@UseGuards(SessionGuard)
export class PessoasController {
  constructor(private readonly atividade: AtividadeService) {}

  @Get()
  buscar(@Query('q') q?: string) {
    return this.atividade.pessoas(q);
  }
}
