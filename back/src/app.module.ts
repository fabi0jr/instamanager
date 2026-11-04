import { Module } from '@nestjs/common';
import { AdminModule } from './admin/admin.module.js';
import { AppController } from './app.controller.js';
import { AuthModule } from './auth/auth.module.js';
import { ClubesController } from './clubes/clubes.controller.js';
import { DenunciasModule } from './denuncias/denuncias.module.js';
import { LigaModule } from './liga/liga.module.js';
import { InteracoesModule } from './interacoes/interacoes.module.js';
import { PostsModule } from './posts/posts.module.js';
import { PrismaModule } from './prisma.module.js';
import { PushModule } from './push/push.module.js';
import { TrocasModule } from './trocas/trocas.module.js';

@Module({ imports: [PrismaModule, AuthModule, PostsModule, InteracoesModule, TrocasModule, AdminModule, PushModule, DenunciasModule, LigaModule], controllers: [AppController, ClubesController] })
export class AppModule {}
