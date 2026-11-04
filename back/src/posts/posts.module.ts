import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { GaleriaController, PostsController } from './posts.controller.js';
import { PostsEventos } from './posts.eventos.js';
import { PostsService } from './posts.service.js';

@Module({
  imports: [AuthModule],
  controllers: [PostsController, GaleriaController],
  providers: [PostsService, PostsEventos],
  exports: [PostsEventos, PostsService],
})
export class PostsModule {}
