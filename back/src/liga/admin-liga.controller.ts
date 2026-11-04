import { Body, Controller, HttpCode, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import { type AuthedRequest, AdminGuard, SessionGuard } from '../auth/session.guard.js';
import { LigaService } from './liga.service.js';

@Controller('admin/rodadas')
@UseGuards(SessionGuard, AdminGuard)
export class AdminLigaController {
  constructor(private readonly liga: LigaService) {}

  @Put(':n/jogos')
  @HttpCode(204)
  async jogos(@Param('n') n: string, @Body() body: unknown) {
    await this.liga.lancarJogos(Number(n), body);
  }

  @Post(':n/fechar')
  @HttpCode(204)
  async fechar(@Param('n') n: string) {
    await this.liga.fechar(Number(n));
  }

  @Post(':n/reabrir')
  @HttpCode(204)
  async reabrir(@Param('n') n: string) {
    await this.liga.reabrir(Number(n));
  }

  @Post(':n/previa')
  previa(@Param('n') n: string) {
    return this.liga.previa(Number(n));
  }

  @Post(':n/publicar')
  publicar(@Req() req: AuthedRequest, @Param('n') n: string, @Body() body: unknown) {
    return this.liga.publicar(req.user, Number(n), body);
  }
}
