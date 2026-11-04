import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PushModule } from '../push/push.module.js';
import { BolaoController } from './bolao.controller.js';
import { BolaoService } from './bolao.service.js';
import { LembreteService } from './lembrete.service.js';

@Module({
  imports: [AuthModule, PushModule],
  controllers: [BolaoController],
  providers: [BolaoService, LembreteService],
  exports: [BolaoService],
})
export class BolaoModule {}
