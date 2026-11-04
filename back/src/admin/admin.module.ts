import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { DenunciasModule } from '../denuncias/denuncias.module.js';
import { InteracoesModule } from '../interacoes/interacoes.module.js';
import { PostsModule } from '../posts/posts.module.js';
import { TrocasModule } from '../trocas/trocas.module.js';
import { AdminController } from './admin.controller.js';

@Module({ imports: [AuthModule, DenunciasModule, InteracoesModule, PostsModule, TrocasModule], controllers: [AdminController] })
export class AdminModule {}
