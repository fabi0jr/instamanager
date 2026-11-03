import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { TrocasController } from './trocas.controller.js';
import { TrocasEventos } from './trocas.eventos.js';
import { TrocasService } from './trocas.service.js';

@Module({
  imports: [AuthModule],
  controllers: [TrocasController],
  providers: [TrocasService, TrocasEventos],
  exports: [TrocasService, TrocasEventos],
})
export class TrocasModule {}
