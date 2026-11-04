import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { type AuthedRequest, SessionGuard } from '../auth/session.guard.js';
import { DenunciasService } from './denuncias.service.js';

@Controller('denuncias')
@UseGuards(SessionGuard)
export class DenunciasController {
  constructor(private readonly denuncias: DenunciasService) {}

  @Post()
  criar(@Req() req: AuthedRequest, @Body() body: unknown) {
    return this.denuncias.criar(req.user, body);
  }
}
