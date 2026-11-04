import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { PrismaService } from '../src/prisma.service.js';
import { apagarClubesDeTeste, cadastrarUsuario, criarApp, criarClubesDeTeste, ORIGIN } from './helpers.js';

// Clubes teste-perfil-N são só deste arquivo.
describe('perfil do técnico: GET /pessoas/:id (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let http: () => ReturnType<INestApplication['getHttpServer']>;
  type U = Awaited<ReturnType<typeof cadastrarUsuario>>;
  let tecnico: U, torcedor: U, admin: U, visitante: U;
  let c: string[];
  const com = (url: string, u: U) => request(http()).get(url).set('Origin', ORIGIN).set('Cookie', u.cookie);
  const novoPost = (authorId: string, clubId: string, texto: string, extra: object = {}) => prisma.post.create({ data: { authorId, clubId, caption: '', texto, ...extra } });
  type Perfil = { id: string; nome: string; avatarUrl: string | null; clube: { id: string } | null; historico: { clube: { id: string }; inicio: string; fim: string | null }[]; posts: { itens: { id: string; texto: string }[]; proximo: string | null } };

  beforeAll(async () => {
    const a = await criarApp();
    ({ app, prisma, http } = a);
    c = await criarClubesDeTeste(prisma, 'perfil', 2);
    tecnico = await cadastrarUsuario(a.post, prisma, c[0], 'Técnico Perfil');
    torcedor = await cadastrarUsuario(a.post, prisma, null, 'Torcedor Perfil');
    admin = await cadastrarUsuario(a.post, prisma, null, 'Admin Perfil');
    visitante = await cadastrarUsuario(a.post, prisma, null, 'Visitante Perfil');
    await prisma.user.update({ where: { id: admin.id }, data: { isAdmin: true } });
    // passou antes pelo outro clube
    await prisma.coachTenure.create({ data: { clubId: c[1], userId: tecnico.id, startedAt: new Date('2026-01-01'), endedAt: new Date('2026-06-01') } });
  });
  afterEach(async () => {
    await prisma.post.deleteMany({ where: { authorId: { in: [tecnico.id, admin.id] } } });
  });
  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: [tecnico.id, torcedor.id, admin.id, visitante.id] } } });
    await apagarClubesDeTeste(prisma, c);
    await app.close();
  });

  it('devolve nome, avatar, clube atual e histórico do mais novo ao mais velho; nada de e-mail', async () => {
    await novoPost(tecnico.id, c[0], 'primeiro');
    const res = await com(`/api/pessoas/${tecnico.id}`, visitante).expect(200);
    const b = res.body as Perfil;
    expect(b).toMatchObject({ id: tecnico.id, nome: 'Técnico Perfil', avatarUrl: null, clube: { id: c[0], nome: expect.any(String), escudoUrl: expect.any(String) } });
    expect(b.historico.map((h) => [h.clube.id, h.fim === null])).toEqual([[c[0], true], [c[1], false]]);
    expect(b.historico[1]).toMatchObject({ inicio: '2026-01-01T00:00:00.000Z', fim: '2026-06-01T00:00:00.000Z' });
    expect(b.posts.itens.map((p) => p.texto)).toEqual(['primeiro']);
    expect(JSON.stringify(res.body)).not.toContain(tecnico.email);
    expect(JSON.stringify(res.body)).not.toMatch(/email|passwordHash/i);
  });

  it('torcedor sem clube: clube null, histórico e posts vazios', async () => {
    const b = (await com(`/api/pessoas/${torcedor.id}`, visitante).expect(200)).body as Perfil;
    expect(b).toMatchObject({ clube: null, historico: [], posts: { itens: [], proximo: null } });
  });

  it('respeita a visibilidade: post oculto pelo admin só o admin vê; "ocultar para mim" some só para quem ocultou', async () => {
    const aberto = await novoPost(tecnico.id, c[0], 'aberto');
    const oculto = await novoPost(tecnico.id, c[0], 'oculto pelo admin', { hiddenAt: new Date() });
    const meu = await novoPost(tecnico.id, c[0], 'escondi');
    await prisma.hiddenPost.create({ data: { userId: visitante.id, postId: meu.id } });
    const textos = async (u: U) => ((await com(`/api/pessoas/${tecnico.id}`, u).expect(200)).body as Perfil).posts.itens.map((p) => p.texto).sort((x, y) => x.localeCompare(y));
    expect(await textos(torcedor)).toEqual(['aberto', 'escondi']);
    expect(await textos(visitante)).toEqual(['aberto']);
    expect(await textos(admin)).toEqual(['aberto', 'escondi', 'oculto pelo admin']);
    expect([aberto.id, oculto.id]).toHaveLength(2);
  });

  it('posts pela CBF (admin) não aparecem no perfil de quem os publicou', async () => {
    await novoPost(admin.id, 'cbf', 'comunicado');
    await novoPost(admin.id, c[0], 'post de clube do admin');
    const b = (await com(`/api/pessoas/${admin.id}`, visitante).expect(200)).body as Perfil;
    expect(b.posts.itens.map((p) => p.texto)).toEqual(['post de clube do admin']);
  });

  it('posts paginam por cursor (12 por página, sem repetir)', async () => {
    for (let i = 0; i < 14; i++) await novoPost(tecnico.id, c[0], `p${i}`, { createdAt: new Date(Date.UTC(2026, 5, 1, 0, i)) });
    const p1 = ((await com(`/api/pessoas/${tecnico.id}`, visitante).expect(200)).body as Perfil).posts;
    expect(p1.itens).toHaveLength(12);
    expect(p1.itens[0].texto).toBe('p13');
    expect(p1.proximo).toEqual(expect.any(String));
    const p2 = ((await com(`/api/pessoas/${tecnico.id}?antes=${encodeURIComponent(p1.proximo!)}`, visitante).expect(200)).body as Perfil).posts;
    expect(p2.itens.map((p) => p.texto)).toEqual(['p1', 'p0']);
    expect(p2.proximo).toBeNull();
  });

  it('pessoa inexistente ou id inválido → 404; sem sessão → 401', async () => {
    await com('/api/pessoas/00000000-0000-4000-8000-000000000000', visitante).expect(404);
    await com('/api/pessoas/nao-e-uuid', visitante).expect(404);
    await request(http()).get(`/api/pessoas/${tecnico.id}`).expect(401);
  });

  it('a busca por ?q continua funcionando na mesma rota base', async () => {
    const r = (await com('/api/pessoas?q=Técnico Perfil', visitante).expect(200)).body as { id: string }[];
    expect(r.map((x) => x.id)).toContain(tecnico.id);
  });
});
