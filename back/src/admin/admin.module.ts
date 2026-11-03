import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { TrocasModule } from '../trocas/trocas.module.js';
import { AdminController } from './admin.controller.js';

@Module({ imports: [AuthModule, TrocasModule], controllers: [AdminController] })
export class AdminModule {}
