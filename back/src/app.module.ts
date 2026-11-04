import { Module } from '@nestjs/common';
import { AdminModule } from './admin/admin.module.js';
import { AppController } from './app.controller.js';
import { AtividadeModule } from './atividade/atividade.module.js';
import { BuscaModule } from './busca/busca.module.js';
import { StoriesModule } from './stories/stories.module.js';
import { AuthModule } from './auth/auth.module.js';
import { ClubesController } from './clubes/clubes.controller.js';
import { DenunciasModule } from './denuncias/denuncias.module.js';
import { LigaModule } from './liga/liga.module.js';
import { CopaModule } from './copa/copa.module.js';
import { InteracoesModule } from './interacoes/interacoes.module.js';
import { VotacoesModule } from './votacoes/votacoes.module.js';
import { ErrosModule } from './erros/erros.module.js';
import { OgModule } from './og/og.module.js';
import { PostsModule } from './posts/posts.module.js';
import { PrismaModule } from './prisma.module.js';
import { PushModule } from './push/push.module.js';
import { TrocasModule } from './trocas/trocas.module.js';

@Module({ imports: [PrismaModule, AuthModule, PostsModule, InteracoesModule, TrocasModule, AdminModule, PushModule, DenunciasModule, LigaModule, CopaModule, VotacoesModule, OgModule, ErrosModule, AtividadeModule, BuscaModule, StoriesModule], controllers: [AppController, ClubesController] })
export class AppModule {}
