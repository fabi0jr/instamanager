import { Controller, Get, HttpCode, Logger, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { type AuthedRequest, SessionGuard } from '../auth/session.guard.js';
import { ConquistasService } from '../conquistas/conquistas.service.js';
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
  private readonly logger = new Logger(PessoasController.name);

  constructor(
    private readonly atividade: AtividadeService,
    private readonly conquistas: ConquistasService,
  ) {}

  @Get()
  buscar(@Query('q') q?: string) {
    return this.atividade.pessoas(q);
  }

  @Get(':id')
  async perfil(@Req() req: AuthedRequest, @Param('id') id: string, @Query('antes') antes?: string) {
    const p = await this.atividade.perfil(req.user, id, antes);
    // se o cálculo falhar, o card some e o perfil segue (o front já esconde quando faltam os campos)
    const extra = await Promise.all([this.conquistas.nivel(p.id), this.conquistas.listar(p.id)]).then(([nivel, conquistas]) => ({ nivel, conquistas }), (e: unknown) => (this.logger.error(`nivel/conquistas de ${p.id}: ${String(e)}`), {}));
    return { ...p, ...extra };
  }
}
