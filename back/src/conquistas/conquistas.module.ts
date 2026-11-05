import { Module } from '@nestjs/common';
import { AtividadeModule } from '../atividade/atividade.module.js';
import { PessoasController } from '../atividade/atividade.controller.js';
import { AuthModule } from '../auth/auth.module.js';
import { BolaoModule } from '../bolao/bolao.module.js';
import { CopaModule } from '../copa/copa.module.js';
import { LigaModule } from '../liga/liga.module.js';
import { PostsModule } from '../posts/posts.module.js';
import { PushModule } from '../push/push.module.js';
import { StoriesModule } from '../stories/stories.module.js';
import { VotacoesModule } from '../votacoes/votacoes.module.js';
import { ConquistasListeners } from './conquistas.listeners.js';
import { ConquistasService } from './conquistas.service.js';

// O PessoasController (perfil com nível e conquistas) mora aqui para a Atividade não importar as Conquistas (que já importam a Atividade).
@Module({
  imports: [AuthModule, AtividadeModule, BolaoModule, CopaModule, LigaModule, PostsModule, PushModule, StoriesModule, VotacoesModule],
  controllers: [PessoasController],
  providers: [ConquistasService, ConquistasListeners],
  exports: [ConquistasService],
})
export class ConquistasModule {}
