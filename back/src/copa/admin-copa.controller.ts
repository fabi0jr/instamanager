import { Body, Controller, HttpCode, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import { type AuthedRequest, AdminGuard, SessionGuard } from '../auth/session.guard.js';
import { CopaService } from './copa.service.js';

@Controller('admin/copa/fases')
@UseGuards(SessionGuard, AdminGuard)
export class AdminCopaController {
  constructor(private readonly copa: CopaService) {}

  @Post()
  criar(@Body() body: unknown) {
    return this.copa.criarFase(body);
  }

  @Put(':id/jogos')
  @HttpCode(204)
  async jogos(@Param('id') id: string, @Body() body: unknown) {
    await this.copa.lancarJogos(id, body);
  }

  @Put(':id/prazo')
  @HttpCode(204)
  async prazo(@Param('id') id: string, @Body() body: unknown) {
    await this.copa.definirPrazo(id, body);
  }

  @Post(':id/fechar')
  fechar(@Param('id') id: string) {
    return this.copa.fechar(id);
  }

  @Post(':id/reabrir')
  @HttpCode(204)
  async reabrir(@Param('id') id: string) {
    await this.copa.reabrir(id);
  }

  @Post(':id/publicar')
  publicar(@Req() req: AuthedRequest, @Param('id') id: string, @Body() body: unknown) {
    return this.copa.publicar(req.user, id, body);
  }
}
