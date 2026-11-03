import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma.service.js';

// Clubes só deste arquivo (os e2e rodam em paralelo): cruzeiro e internacional.
describe('clubes (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const ids: string[] = [];
  const criarUsuario = async (name: string) => {
    const u = await prisma.user.create({ data: { email: `teste-${randomUUID()}@exemplo.com`, passwordHash: 'x', name } });
    ids.push(u.id);
    return u;
  };

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = modulo.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    prisma = app.get(PrismaService);
    await prisma.club.upsert({ where: { id: 'cruzeiro' }, update: {}, create: { id: 'cruzeiro', name: 'Cruzeiro', crestPath: '/escudos/cruzeiro.svg' } });
    await prisma.club.upsert({ where: { id: 'internacional' }, update: {}, create: { id: 'internacional', name: 'Internacional', crestPath: '/escudos/internacional.svg' } });
  });
  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: ids } } }); // solta o coachId e apaga as tenures
    await app.close();
  });

  it('livres=1 omite clube com técnico; sem o filtro ele aparece com o técnico', async () => {
    const tecnico = await criarUsuario('Lincoln');
    await prisma.club.update({ where: { id: 'cruzeiro' }, data: { coachId: tecnico.id } });

    const livres = await request(app.getHttpServer()).get('/api/clubes?livres=1').expect(200);
    expect(livres.body.map((c: { id: string }) => c.id)).not.toContain('cruzeiro');
    expect(livres.body.every((c: { tecnico: unknown }) => c.tecnico === null)).toBe(true);

    const todos = await request(app.getHttpServer()).get('/api/clubes').expect(200);
    expect(todos.body.find((c: { id: string }) => c.id === 'cruzeiro')).toEqual({
      id: 'cruzeiro',
      nome: 'Cruzeiro',
      escudoUrl: '/escudos/cruzeiro.svg',
      tecnico: { id: tecnico.id, nome: 'Lincoln' },
    });
    const nomes = todos.body.map((c: { nome: string }) => c.nome);
    expect(nomes).toEqual([...nomes].sort((a: string, b: string) => a.localeCompare(b, 'pt-BR')));
  });

  it('histórico lista a tenure fechada com fim e a aberta com fim null, do mais novo ao mais velho', async () => {
    const antigo = await criarUsuario('Antigo');
    const atual = await criarUsuario('Atual');
    await prisma.coachTenure.create({
      data: { clubId: 'internacional', userId: antigo.id, startedAt: new Date('2026-01-10T12:00:00Z'), endedAt: new Date('2026-02-10T12:00:00Z') },
    });
    await prisma.coachTenure.create({ data: { clubId: 'internacional', userId: atual.id, startedAt: new Date('2026-02-10T12:00:00Z') } });
    await prisma.club.update({ where: { id: 'internacional' }, data: { coachId: atual.id } });

    const res = await request(app.getHttpServer()).get('/api/clubes/internacional').expect(200);
    expect(res.body).toEqual({
      id: 'internacional',
      nome: 'Internacional',
      escudoUrl: '/escudos/internacional.svg',
      tecnico: { id: atual.id, nome: 'Atual' },
      historico: [
        { usuario: { id: atual.id, nome: 'Atual' }, inicio: '2026-02-10T12:00:00.000Z', fim: null },
        { usuario: { id: antigo.id, nome: 'Antigo' }, inicio: '2026-01-10T12:00:00.000Z', fim: '2026-02-10T12:00:00.000Z' },
      ],
    });
  });

  it('clube inexistente → 404 NAO_ENCONTRADO', async () => {
    const res = await request(app.getHttpServer()).get('/api/clubes/nao-existe').expect(404);
    expect(res.body.codigo).toBe('NAO_ENCONTRADO');
  });
});
