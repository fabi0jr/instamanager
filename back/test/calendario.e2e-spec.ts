import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { PrismaService } from '../src/prisma.service.js';
import { apagarClubesDeTeste, cadastrarUsuario, criarApp, criarClubesDeTeste, ORIGIN } from './helpers.js';

// Rodadas 35 e 36 e clubes teste-calendario-N são só deste arquivo.
describe('calendário: jogos agendados, prazo e fechar com placar (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let http: () => ReturnType<INestApplication['getHttpServer']>;
  type U = Awaited<ReturnType<typeof cadastrarUsuario>>;
  let admin: U, torcedor: U;
  let c: string[];
  const com = (m: 'get' | 'put' | 'post', url: string, u: U) => request(http())[m](url).set('Origin', ORIGIN).set('Cookie', u.cookie);
  const jogo = (m: string, v: string, gm: number | null, gv: number | null) => ({ mandanteId: m, visitanteId: v, golsMandante: gm, golsVisitante: gv });
  const lancar = (n: number, jogos: unknown, u: U = admin) => com('put', `/api/admin/rodadas/${n}/jogos`, u).send({ jogos });

  beforeAll(async () => {
    const a = await criarApp();
    ({ app, prisma, http } = a);
    c = await criarClubesDeTeste(prisma, 'calendario', 4);
    torcedor = await cadastrarUsuario(a.post, prisma, null, 'Torcedor');
    admin = await cadastrarUsuario(a.post, prisma, null, 'Admin');
    await prisma.user.update({ where: { id: admin.id }, data: { isAdmin: true } });
  });
  afterEach(async () => {
    await prisma.jogo.deleteMany({ where: { rodadaNumero: { in: [35, 36] } } });
    await prisma.rodada.updateMany({ where: { numero: { in: [35, 36] } }, data: { fechadaEm: null, prazoPalpite: null } });
  });
  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: [admin.id, torcedor.id] } } });
    await apagarClubesDeTeste(prisma, c);
    await app.close();
  });

  it('PUT jogos aceita gols nulos nos dois lados (agendado); só um lado nulo → 400', async () => {
    await lancar(35, [jogo(c[0], c[1], null, null), jogo(c[2], c[3], 1, 0)]).expect(204);
    const r = (await com('get', '/api/liga/rodadas', torcedor).expect(200)).body.find((x: { numero: number }) => x.numero === 35);
    expect(r.jogos.map((j: { golsMandante: number | null }) => j.golsMandante).sort()).toEqual([1, null]);
    await lancar(35, [jogo(c[0], c[1], 1, null)]).expect(400);
    await lancar(35, [jogo(c[0], c[1], null, 2)]).expect(400);
  });

  it('fechar com jogo sem placar → 409 PLACAR_PENDENTE e a rodada continua aberta; com todos os placares fecha', async () => {
    await lancar(35, [jogo(c[0], c[1], null, null), jogo(c[2], c[3], 1, 0)]).expect(204);
    expect((await com('post', '/api/admin/rodadas/35/fechar', admin).expect(409)).body.codigo).toBe('PLACAR_PENDENTE');
    expect((await prisma.rodada.findUnique({ where: { numero: 35 } }))!.fechadaEm).toBeNull();
    await lancar(35, [jogo(c[0], c[1], 2, 2), jogo(c[2], c[3], 1, 0)]).expect(204);
    await com('post', '/api/admin/rodadas/35/fechar', admin).expect(204);
  });

  it('prazo: PUT grava e aparece em /liga/rodadas; null tira; data inválida → 400; rodada fora de 1–38 → 404; não-admin → 403', async () => {
    const prazo = '2026-12-01T20:00:00.000Z';
    await com('put', '/api/admin/rodadas/35/prazo', admin).send({ prazoPalpite: prazo }).expect(204);
    const lista = async () => (await com('get', '/api/liga/rodadas', torcedor).expect(200)).body.find((x: { numero: number }) => x.numero === 35);
    expect((await lista()).prazoPalpite).toBe(prazo);
    await com('put', '/api/admin/rodadas/35/prazo', admin).send({ prazoPalpite: null }).expect(204);
    expect((await lista()).prazoPalpite).toBeNull();
    await com('put', '/api/admin/rodadas/35/prazo', admin).send({ prazoPalpite: 'ontem' }).expect(400);
    await com('put', '/api/admin/rodadas/35/prazo', admin).send({}).expect(400);
    await com('put', '/api/admin/rodadas/39/prazo', admin).send({ prazoPalpite: prazo }).expect(404);
    await com('put', '/api/admin/rodadas/35/prazo', torcedor).send({ prazoPalpite: prazo }).expect(403);
  });

  it('GET /liga/calendario: só jogos sem placar de rodada aberta, por prazo (sem prazo por último)', async () => {
    await lancar(36, [jogo(c[0], c[1], null, null)]).expect(204);
    await lancar(35, [jogo(c[2], c[3], null, null)]).expect(204);
    await com('put', '/api/admin/rodadas/36/prazo', admin).send({ prazoPalpite: '2099-01-01T00:00:00.000Z' }).expect(204);
    const itens = (await com('get', '/api/liga/calendario', torcedor).expect(200)).body as { tipo: string; rodada: number | null; mandante: { id: string } }[];
    const meus = itens.filter((i) => c.includes(i.mandante.id));
    expect(meus.map((i) => [i.tipo, i.rodada, i.mandante.id])).toEqual([['BRASILEIRAO', 36, c[0]], ['BRASILEIRAO', 35, c[2]]]);
    expect(meus[0]).toMatchObject({ prazoPalpite: '2099-01-01T00:00:00.000Z', fase: null, id: expect.any(String), visitante: { id: c[1], nome: expect.any(String), escudoUrl: expect.any(String) } });
    await com('get', '/api/liga/calendario', { cookie: [] } as unknown as U).expect(401);
  });
});
