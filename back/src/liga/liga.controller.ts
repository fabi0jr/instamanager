import { Controller, Get, UseGuards } from '@nestjs/common';
import { SessionGuard } from '../auth/session.guard.js';
import { LigaService } from './liga.service.js';

@Controller('liga')
@UseGuards(SessionGuard)
export class LigaController {
  constructor(private readonly liga: LigaService) {}

  @Get('tabela')
  tabela() {
    return this.liga.tabela();
  }

  @Get('rodadas')
  rodadas() {
    return this.liga.rodadas();
  }
}
