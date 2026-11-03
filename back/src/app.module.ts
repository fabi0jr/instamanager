import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AuthModule } from './auth/auth.module.js';
import { ClubesController } from './clubes/clubes.controller.js';
import { PostsModule } from './posts/posts.module.js';
import { PrismaModule } from './prisma.module.js';

@Module({ imports: [PrismaModule, AuthModule, PostsModule], controllers: [AppController, ClubesController] })
export class AppModule {}
