import { Body, Controller, HttpCode, Param, Post, Put, UseGuards } from '@nestjs/common';
import { AdminGuard, SessionGuard } from '../auth/session.guard.js';
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
}
