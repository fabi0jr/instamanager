import { Body, Controller, Get, HttpCode, Param, Put, Query, Req, UseGuards } from '@nestjs/common';
import { type AuthedRequest, SessionGuard } from '../auth/session.guard.js';
import { BolaoService } from './bolao.service.js';

@Controller('bolao')
@UseGuards(SessionGuard)
export class BolaoController {
  constructor(private readonly bolao: BolaoService) {}

  @Put('palpites')
  @HttpCode(204)
  async palpitar(@Req() req: AuthedRequest, @Body() body: unknown) {
    await this.bolao.palpitar(req.user.id, body);
  }

  @Get('meus')
  meus(@Req() req: AuthedRequest, @Query('rodada') rodada?: string, @Query('fase') fase?: string) {
    return this.bolao.meus(req.user.id, { rodada, fase });
  }

  @Get('jogo/:tipo/:id')
  doJogo(@Req() req: AuthedRequest, @Param('tipo') tipo: string, @Param('id') id: string) {
    return this.bolao.doJogo(req.user.id, tipo, id);
  }

  @Get('ranking')
  ranking() {
    return this.bolao.ranking();
  }
}
