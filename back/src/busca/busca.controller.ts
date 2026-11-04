import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { type AuthedRequest, SessionGuard } from '../auth/session.guard.js';
import { BuscaService } from './busca.service.js';

@Controller('busca')
@UseGuards(SessionGuard)
export class BuscaController {
  constructor(private readonly busca: BuscaService) {}

  @Get()
  buscar(@Req() req: AuthedRequest, @Query('q') q?: string, @Query('tipo') tipo?: string, @Query('antes') antes?: string) {
    return this.busca.buscar(req.user, q, tipo, antes);
  }
}
