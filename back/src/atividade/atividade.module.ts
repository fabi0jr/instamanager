import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { InteracoesModule } from '../interacoes/interacoes.module.js';
import { PostsModule } from '../posts/posts.module.js';
import { PushModule } from '../push/push.module.js';
import { TrocasModule } from '../trocas/trocas.module.js';
import { AtividadeController } from './atividade.controller.js';
import { AtividadeListeners } from './atividade.listeners.js';
import { AtividadeService } from './atividade.service.js';

@Module({
  imports: [AuthModule, PostsModule, InteracoesModule, TrocasModule, PushModule],
  controllers: [AtividadeController],
  providers: [AtividadeService, AtividadeListeners],
  exports: [AtividadeService],
})
export class AtividadeModule {}
