import { randomUUID } from 'node:crypto';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/http.js';
import { PrismaService } from '../src/prisma.service.js';

process.env.APP_URL ??= 'http://localhost:5173';
process.env.TRUST_PROXY = '1'; // os testes simulam IPs pelo X-Forwarded-For
export const ORIGIN = process.env.APP_URL;

export async function criarApp() {
  const modulo = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = modulo.createNestApplication<NestExpressApplication>({ bodyParser: false });
  configureApp(app);
  app.setGlobalPrefix('api');
  await app.init();
  const prisma = app.get(PrismaService);
  const http = () => app.getHttpServer();
  const post = (url: string, body: object, ip = '10.0.0.1') =>
    request(http()).post(url).set('Origin', ORIGIN).set('X-Forwarded-For', ip).send(body);
  return { app, prisma, http, post };
}

export const novoEmail = () => `teste-${randomUUID()}@exemplo.com`;

/** Código de convite vigente (o seed grava um; sem seed, cria o de teste). */
export async function convite(prisma: PrismaService) {
  const s = await prisma.setting.upsert({ where: { key: 'inviteCode' }, update: {}, create: { key: 'inviteCode', value: 'convite-teste' } });
  return s.value;
}
