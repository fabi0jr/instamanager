import { Controller, Get, UseGuards } from '@nestjs/common';
import { SessionGuard } from '../auth/session.guard.js';
import { CopaService } from './copa.service.js';

@Controller('copa')
@UseGuards(SessionGuard)
export class CopaController {
  constructor(private readonly copa: CopaService) {}

  @Get()
  chave() {
    return this.copa.chave();
  }
}
