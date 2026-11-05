import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { StoriesController } from './stories.controller.js';
import { StoriesEventos } from './stories.eventos.js';
import { StoriesService } from './stories.service.js';

@Module({ imports: [AuthModule], controllers: [StoriesController], providers: [StoriesService, StoriesEventos], exports: [StoriesEventos] })
export class StoriesModule {}
