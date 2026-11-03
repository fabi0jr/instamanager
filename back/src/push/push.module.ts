import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { InteracoesModule } from '../interacoes/interacoes.module.js';
import { PostsModule } from '../posts/posts.module.js';
import { TrocasModule } from '../trocas/trocas.module.js';
import { PushController } from './push.controller.js';
import { PushListeners } from './push.listeners.js';
import { PushService } from './push.service.js';

@Module({
  imports: [AuthModule, PostsModule, InteracoesModule, TrocasModule],
  controllers: [PushController],
  providers: [PushService, PushListeners],
  exports: [PushService],
})
export class PushModule {}
