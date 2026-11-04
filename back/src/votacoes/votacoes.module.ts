import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { AtividadeModule } from '../atividade/atividade.module.js';
import { PostsModule } from '../posts/posts.module.js';
import { AdminVotacoesController, VotacoesController } from './votacoes.controller.js';
import { VotacoesService } from './votacoes.service.js';

@Module({ imports: [AuthModule, PostsModule, AtividadeModule], controllers: [VotacoesController, AdminVotacoesController], providers: [VotacoesService] })
export class VotacoesModule {}
