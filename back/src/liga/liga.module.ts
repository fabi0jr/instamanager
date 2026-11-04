import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PostsModule } from '../posts/posts.module.js';
import { PushModule } from '../push/push.module.js';
import { AdminLigaController } from './admin-liga.controller.js';
import { LigaController } from './liga.controller.js';
import { LigaEventos } from './liga.eventos.js';
import { LigaService } from './liga.service.js';

@Module({
  imports: [AuthModule, PostsModule, PushModule],
  controllers: [LigaController, AdminLigaController],
  providers: [LigaService, LigaEventos],
  exports: [LigaService, LigaEventos],
})
export class LigaModule {}
