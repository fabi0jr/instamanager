import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { TrocasEventos } from '../src/trocas/trocas.eventos.js';
import type { PrismaService } from '../src/prisma.service.js';
import { cadastrarUsuario, criarApp, ORIGIN } from './helpers.js';

// Clubes só deste arquivo (os e2e rodam em paralelo): gremio, bahia, atletico-mg, athletico-pr, corinthians, chapecoense, sao-paulo.
describe('trocas de time e admin (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let post: Awaited<ReturnType<typeof criarApp>>['post'];
  let http: () => ReturnType<INestApplication['getHttpServer']>;
  type U = Awaited<ReturnType<typeof cadastrarUsuario>>;
  let admin: U;
  const ids: string[] = [];
  const com = (m: 'get' | 'put' | 'post' | 'delete', url: string, u: U) => request(http())[m](url).set('Origin', ORIGIN).set('Cookie', u.cookie);
  const novo = async (clubeId: string | null, nome = 'Fulano') => {
    const u = await cadastrarUsuario(post, prisma, clubeId, nome);
    ids.push(u.id);
    return u;
  };
  const pedir = (u: U, corpo: object) => com('post', '/api/trocas', u).send(corpo);
  const coach = async (clubId: string) => (await prisma.club.findUniqueOrThrow({ where: { id: clubId } })).coachId;
  const abertas = (clubId: string) => prisma.coachTenure.findMany({ where: { clubId, endedAt: null } });

  beforeAll(async () => {
    ({ app, prisma, post, http } = await criarApp());
    admin = await novo(null, 'Admin');
    await prisma.user.update({ where: { id: admin.id }, data: { isAdmin: true } });
  });
  afterAll(async () => {
    await prisma.post.deleteMany({ where: { clubId: { in: ['sao-paulo', 'chapecoense'] } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } }); // solta os clubes (SetNull) e apaga pedidos/tenures
    await app.close();
  });

  describe('pedidos', () => {
    it('ASSUMIR clube livre: 201 PENDENTE, emite trocas.pedida; segundo pedido pendente → 409 TROCA_PENDENTE', async () => {
      const ouvidos: string[] = [];
      app.get(TrocasEventos).on('trocas.pedida', (id: string) => ouvidos.push(id));
      const u = await novo(null);
      const res = await pedir(u, { tipo: 'ASSUMIR', clubeId: 'gremio' }).expect(201);
      expect(res.body).toMatchObject({ tipo: 'ASSUMIR', clubeId: 'gremio', status: 'PENDENTE' });
      await vi.waitFor(() => expect(ouvidos).toContain(res.body.id));
      const dup = await pedir(u, { tipo: 'ASSUMIR', clubeId: 'gremio' }).expect(409);
      expect(dup.body.codigo).toBe('TROCA_PENDENTE');
      expect((await com('get', '/api/trocas/minhas', u).expect(200)).body).toHaveLength(1);
      await prisma.transferRequest.deleteMany({ where: { userId: u.id } });
    });

    it('dois pedidos simultâneos da mesma pessoa → um 201 e um 409', async () => {
      const u = await novo(null);
      const rs = await Promise.all([pedir(u, { tipo: 'ASSUMIR', clubeId: 'gremio' }), pedir(u, { tipo: 'ASSUMIR', clubeId: 'gremio' })]);
      expect(rs.map((r) => r.status).sort((a, b) => a - b)).toEqual([201, 409]);
      expect(await prisma.transferRequest.count({ where: { userId: u.id } })).toBe(1);
    });

    it('ASSUMIR clube ocupado na hora do pedido → 409 CLUBE_OCUPADO; clube inexistente → 404; sem clubeId → 400', async () => {
      const dono = await novo('bahia');
      const u = await novo(null);
      expect((await pedir(u, { tipo: 'ASSUMIR', clubeId: 'bahia' }).expect(409)).body.codigo).toBe('CLUBE_OCUPADO');
      await pedir(u, { tipo: 'ASSUMIR', clubeId: 'nao-existe' }).expect(404);
      await pedir(u, { tipo: 'ASSUMIR' }).expect(400);
      await pedir(u, { tipo: 'VOAR' }).expect(400);
      expect(await coach('bahia')).toBe(dono.id);
    });

    it('SAIR sem clube → 403 SEM_CLUBE', async () => {
      const u = await novo(null);
      expect((await pedir(u, { tipo: 'SAIR' }).expect(403)).body.codigo).toBe('SEM_CLUBE');
    });
  });

  describe('decisão do admin', () => {
    it('aprovar ASSUMIR de quem tem clube: fecha a tenure antiga, abre a nova e move o coachId', async () => {
      const ouvidos: string[] = [];
      app.get(TrocasEventos).on('trocas.decidida', (id: string) => ouvidos.push(id));
      const u = await novo('atletico-mg');
      const t = (await pedir(u, { tipo: 'ASSUMIR', clubeId: 'gremio' }).expect(201)).body;
      const lista = (await com('get', '/api/admin/trocas?status=PENDENTE', admin).expect(200)).body as { id: string; clubeAtual: { id: string }; clubeDesejado: { id: string }; usuario: { id: string } }[];
      expect(lista.find((x) => x.id === t.id)).toMatchObject({ tipo: 'ASSUMIR', status: 'PENDENTE', usuario: { id: u.id }, clubeAtual: { id: 'atletico-mg' }, clubeDesejado: { id: 'gremio' } });

      await com('post', `/api/admin/trocas/${t.id}/aprovar`, admin).expect(204);
      expect(await coach('atletico-mg')).toBeNull();
      expect(await coach('gremio')).toBe(u.id);
      expect(await abertas('atletico-mg')).toHaveLength(0);
      expect((await prisma.coachTenure.findMany({ where: { clubId: 'atletico-mg', userId: u.id } }))[0].endedAt).not.toBeNull();
      expect((await abertas('gremio')).map((x) => x.userId)).toEqual([u.id]);
      expect((await prisma.transferRequest.findUniqueOrThrow({ where: { id: t.id } })).status).toBe('APROVADA');
      expect((await com('get', '/api/me', u).expect(200)).body.clube.id).toBe('gremio');
      await vi.waitFor(() => expect(ouvidos).toContain(t.id));
      // decidir de novo não vale
      expect((await com('post', `/api/admin/trocas/${t.id}/recusar`, admin).expect(409)).body.codigo).toBe('TROCA_JA_DECIDIDA');
      await prisma.club.update({ where: { id: 'gremio' }, data: { coachId: null } });
    });

    it('aprovar ASSUMIR com clube ocupado depois do pedido → 409 CLUBE_OCUPADO, nada muda e o pedido segue PENDENTE', async () => {
      const u = await novo('athletico-pr');
      const intruso = await novo(null);
      const t = (await pedir(u, { tipo: 'ASSUMIR', clubeId: 'corinthians' }).expect(201)).body;
      await prisma.club.update({ where: { id: 'corinthians' }, data: { coachId: intruso.id } }); // ocupado depois do pedido

      const res = await com('post', `/api/admin/trocas/${t.id}/aprovar`, admin).expect(409);
      expect(res.body.codigo).toBe('CLUBE_OCUPADO');
      expect(await coach('athletico-pr')).toBe(u.id); // quem pediu continua no clube de antes
      expect(await coach('corinthians')).toBe(intruso.id);
      expect(await abertas('athletico-pr')).toHaveLength(1);
      const depois = await prisma.transferRequest.findUniqueOrThrow({ where: { id: t.id } });
      expect(depois).toMatchObject({ status: 'PENDENTE', decidedAt: null });
      await prisma.club.update({ where: { id: 'corinthians' }, data: { coachId: null } });
    });

    it('aprovar SAIR: a pessoa vira torcedor, a tenure fecha e os posts ficam no clube', async () => {
      const u = await novo('chapecoense');
      const p = await prisma.post.create({ data: { clubId: 'chapecoense', authorId: u.id, caption: 'ficou' } });
      const t = (await pedir(u, { tipo: 'SAIR' }).expect(201)).body;
      await com('post', `/api/admin/trocas/${t.id}/aprovar`, admin).expect(204);
      expect(await coach('chapecoense')).toBeNull();
      expect(await abertas('chapecoense')).toHaveLength(0);
      expect((await com('get', '/api/me', u).expect(200)).body.clube).toBeNull();
      expect((await prisma.post.findUniqueOrThrow({ where: { id: p.id } })).clubId).toBe('chapecoense');
    });

    it('recusar: 204, RECUSADA, nada muda e a pessoa pode pedir de novo', async () => {
      const u = await novo(null);
      const t = (await pedir(u, { tipo: 'ASSUMIR', clubeId: 'gremio' }).expect(201)).body;
      await com('post', `/api/admin/trocas/${t.id}/recusar`, admin).expect(204);
      expect((await prisma.transferRequest.findUniqueOrThrow({ where: { id: t.id } })).status).toBe('RECUSADA');
      expect(await coach('gremio')).toBeNull();
      await pedir(u, { tipo: 'ASSUMIR', clubeId: 'gremio' }).expect(201);
      expect((await com('get', '/api/trocas/minhas', u).expect(200)).body.map((x: { status: string }) => x.status)).toEqual(['PENDENTE', 'RECUSADA']);
    });

    it('pedido inexistente → 404', async () => {
      await com('post', '/api/admin/trocas/00000000-0000-4000-8000-000000000000/aprovar', admin).expect(404);
    });
  });

  describe('admin', () => {
    it('não-admin em /api/admin/* → 403 NAO_E_ADMIN', async () => {
      const u = await novo(null);
      for (const [m, url] of [
        ['get', '/api/admin/trocas'],
        ['post', '/api/admin/trocas/00000000-0000-4000-8000-000000000000/aprovar'],
        ['get', '/api/admin/convite'],
        ['put', '/api/admin/convite'],
        ['post', '/api/admin/clubes/sao-paulo/remover-tecnico'],
      ] as const) {
        const res = await com(m, url, u).send({}).expect(403);
        expect(res.body.codigo).toBe('NAO_E_ADMIN');
      }
      await request(http()).get('/api/admin/convite').expect(401);
    });

    it('remover-tecnico: fecha a tenure, libera o clube e deixa a pessoa torcedora; repetir é 204', async () => {
      const u = await novo('sao-paulo');
      await com('post', '/api/admin/clubes/sao-paulo/remover-tecnico', admin).expect(204);
      expect(await coach('sao-paulo')).toBeNull();
      expect(await abertas('sao-paulo')).toHaveLength(0);
      expect((await com('get', '/api/me', u).expect(200)).body.clube).toBeNull();
      await com('post', '/api/admin/clubes/sao-paulo/remover-tecnico', admin).expect(204);
      await com('post', '/api/admin/clubes/nao-existe/remover-tecnico', admin).expect(404);
    });
  });
});
