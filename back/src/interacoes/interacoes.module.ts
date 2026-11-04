import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { InteracoesController } from './interacoes.controller.js';
import { InteracoesEventos } from './interacoes.eventos.js';
import { InteracoesService } from './interacoes.service.js';

@Module({
  imports: [AuthModule],
  controllers: [InteracoesController],
  providers: [InteracoesService, InteracoesEventos],
  exports: [InteracoesEventos, InteracoesService],
})
export class InteracoesModule {}
