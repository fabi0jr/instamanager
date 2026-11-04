import { Body, Controller, Get, HttpCode, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { type AuthedRequest, AdminGuard, SessionGuard } from '../auth/session.guard.js';
import { VotacoesService } from './votacoes.service.js';

@Controller('votacoes')
@UseGuards(SessionGuard)
export class VotacoesController {
  constructor(private readonly votacoes: VotacoesService) {}

  @Get()
  listar(@Req() req: AuthedRequest, @Query('encerradas') encerradas?: string) {
    return encerradas === '1' ? this.votacoes.encerradas() : this.votacoes.listar(req.user);
  }

  @Get(':id')
  obter(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.votacoes.obter(id, req.user);
  }

  @Post(':id/voto')
  @HttpCode(204)
  async votar(@Req() req: AuthedRequest, @Param('id') id: string, @Body() body: unknown) {
    await this.votacoes.votar(id, req.user, body);
  }
}

@Controller('admin/votacoes')
@UseGuards(SessionGuard, AdminGuard)
export class AdminVotacoesController {
  constructor(private readonly votacoes: VotacoesService) {}

  @Post()
  criar(@Req() req: AuthedRequest, @Body() body: unknown) {
    return this.votacoes.criar(req.user, body);
  }

  @Post(':id/encerrar')
  encerrar(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.votacoes.encerrar(req.user, id);
  }
}
