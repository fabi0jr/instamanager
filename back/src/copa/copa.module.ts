import { Module } from '@nestjs/common';
import { BolaoModule } from '../bolao/bolao.module.js';
import { AtividadeModule } from '../atividade/atividade.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { PostsModule } from '../posts/posts.module.js';
import { PushModule } from '../push/push.module.js';
import { AdminCopaController } from './admin-copa.controller.js';
import { CopaController } from './copa.controller.js';
import { CopaService } from './copa.service.js';

@Module({
  imports: [BolaoModule, AuthModule, PostsModule, PushModule, AtividadeModule],
  controllers: [CopaController, AdminCopaController],
  providers: [CopaService],
  exports: [CopaService],
})
export class CopaModule {}
