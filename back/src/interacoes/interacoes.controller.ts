import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import { type AuthedRequest, SessionGuard } from '../auth/session.guard.js';
import { InteracoesService } from './interacoes.service.js';

@Controller()
@UseGuards(SessionGuard)
export class InteracoesController {
  constructor(private readonly interacoes: InteracoesService) {}

  @Put('posts/:id/curtida')
  @HttpCode(204)
  async curtir(@Req() req: AuthedRequest, @Param('id') id: string) {
    await this.interacoes.curtir(id, req.user);
  }

  @Delete('posts/:id/curtida')
  @HttpCode(204)
  async descurtir(@Req() req: AuthedRequest, @Param('id') id: string) {
    await this.interacoes.descurtir(id, req.user);
  }

  @Get('posts/:id/comentarios')
  listar(@Param('id') id: string) {
    return this.interacoes.listar(id);
  }

  @Post('posts/:id/comentarios')
  comentar(@Req() req: AuthedRequest, @Param('id') id: string, @Body() body: unknown) {
    return this.interacoes.comentar(id, req.user, body);
  }

  @Delete('comentarios/:id')
  @HttpCode(204)
  async apagar(@Req() req: AuthedRequest, @Param('id') id: string) {
    await this.interacoes.apagar(id, req.user);
  }
}
