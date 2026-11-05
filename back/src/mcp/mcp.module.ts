import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { BolaoModule } from '../bolao/bolao.module.js';
import { CopaModule } from '../copa/copa.module.js';
import { LigaModule } from '../liga/liga.module.js';
import { PostsModule } from '../posts/posts.module.js';
import { StoriesModule } from '../stories/stories.module.js';
import { VotacoesModule } from '../votacoes/votacoes.module.js';
import { McpController } from './mcp.controller.js';
import { McpService } from './mcp.service.js';

@Module({
  imports: [
    AuthModule,
    PostsModule,
    StoriesModule,
    VotacoesModule,
    LigaModule,
    CopaModule,
    BolaoModule,
  ],
  controllers: [McpController],
  providers: [McpService],
})
export class McpModule {}
