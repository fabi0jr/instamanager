import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { ClubesController } from './clubes/clubes.controller.js';
import { PrismaModule } from './prisma.module.js';

@Module({ imports: [PrismaModule], controllers: [AppController, ClubesController] })
export class AppModule {}
