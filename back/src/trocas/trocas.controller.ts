import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { type AuthedRequest, SessionGuard } from '../auth/session.guard.js';
import { TrocasService } from './trocas.service.js';

@Controller('trocas')
@UseGuards(SessionGuard)
export class TrocasController {
  constructor(private readonly trocas: TrocasService) {}

  @Post()
  pedir(@Req() req: AuthedRequest, @Body() body: unknown) {
    return this.trocas.pedir(req.user, body);
  }

  @Get('minhas')
  minhas(@Req() req: AuthedRequest) {
    return this.trocas.minhas(req.user);
  }
}
