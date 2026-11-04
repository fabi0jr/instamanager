import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { ErrosController } from './erros.controller.js';

@Module({ imports: [AuthModule], controllers: [ErrosController] })
export class ErrosModule {}
