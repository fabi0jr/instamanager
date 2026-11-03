import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service.js';

// global: um só pool de conexões para todos os módulos
@Global()
@Module({ providers: [PrismaService], exports: [PrismaService] })
export class PrismaModule {}
