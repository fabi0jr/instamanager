import { Module } from '@nestjs/common';
import { AtividadeModule } from '../atividade/atividade.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { PostsModule } from '../posts/posts.module.js';
import { BuscaController } from './busca.controller.js';
import { BuscaService } from './busca.service.js';

@Module({ imports: [AuthModule, PostsModule, AtividadeModule], controllers: [BuscaController], providers: [BuscaService] })
export class BuscaModule {}
