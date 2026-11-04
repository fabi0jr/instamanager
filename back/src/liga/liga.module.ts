import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { AdminLigaController } from './admin-liga.controller.js';
import { LigaController } from './liga.controller.js';
import { LigaEventos } from './liga.eventos.js';
import { LigaService } from './liga.service.js';

@Module({
  imports: [AuthModule],
  controllers: [LigaController, AdminLigaController],
  providers: [LigaService, LigaEventos],
  exports: [LigaService, LigaEventos],
})
export class LigaModule {}
