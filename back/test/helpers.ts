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

let ipSeq = 0;
/** Cadastra um usuário (clubeId ou null = torcedor) e devolve id, e-mail e cookie de sessão. */
export async function cadastrarUsuario(post: Awaited<ReturnType<typeof criarApp>>['post'], prisma: PrismaService, clubeId: string | null, nome = 'Fulano') {
  const email = novoEmail();
  const res = await post('/api/auth/cadastro', { convite: await convite(prisma), email, senha: 'senha-boa-123', nome, clubeId }, `10.6.${Math.floor(++ipSeq / 250)}.${(ipSeq % 250) + 1}`).expect(201);
  return { id: res.body.id as string, email, cookie: res.headers['set-cookie'] as unknown as string[] };
}

/**
 * Clubes próprios do arquivo de teste (ids `teste-<arquivo>-N`), para não disputar os 20 clubes reais entre
 * arquivos que rodam em paralelo. Apaga sobras de uma execução interrompida antes de criar.
 */
export async function criarClubesDeTeste(prisma: PrismaService, arquivo: string, n: number) {
  const ids = Array.from({ length: n }, (_, i) => `teste-${arquivo}-${i + 1}`);
  await apagarClubesDeTeste(prisma, ids);
  await prisma.club.createMany({ data: ids.map((id, i) => ({ id, name: `Teste ${arquivo} ${i + 1}`, crestPath: '/escudos/generico.svg' })) });
  return ids;
}

/** Apaga os clubes de teste e o que aponta para eles (chame no afterAll, antes ou depois de apagar os usuários). */
export async function apagarClubesDeTeste(prisma: PrismaService, ids: string[]) {
  const clubId = { in: ids };
  await prisma.jogo.deleteMany({ where: { OR: [{ mandanteId: clubId }, { visitanteId: clubId }] } });
  await prisma.copaJogo.deleteMany({ where: { OR: [{ mandanteId: clubId }, { visitanteId: clubId }] } });
  await prisma.story.deleteMany({ where: { clubId } });
  await prisma.post.deleteMany({ where: { clubId } });
  await prisma.transferRequest.deleteMany({ where: { clubId } });
  await prisma.coachTenure.deleteMany({ where: { clubId } });
  await prisma.club.deleteMany({ where: { id: clubId } });
}
