import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { PrismaService } from '../src/prisma.service.js';
import { apagarClubesDeTeste, cadastrarUsuario, criarApp, criarClubesDeTeste, ORIGIN } from './helpers.js';

// Clube teste-reacoes-lista-1 é só deste arquivo (os e2e rodam em paralelo no mesmo banco).
describe('GET /posts/:id/reacoes (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let http: () => ReturnType<INestApplication['getHttpServer']>;
  type U = Awaited<ReturnType<typeof cadastrarUsuario>>;
  let tecnico: U, u1: U, u2: U, u3: U, admin: U;
  let clube: string;
  const usuarios: string[] = [];
  const com = (m: 'get' | 'put', url: string, u: U) => request(http())[m](url).set('Origin', ORIGIN).set('Cookie', u.cookie);
  const novoPost = async () => (await prisma.post.create({ data: { clubId: clube, authorId: tecnico.id, caption: 'p' } })).id;
  const reagir = (id: string, u: U, emoji: string) => com('put', `/api/posts/${id}/reacao`, u).send({ emoji }).expect(204);

  beforeAll(async () => {
    const c = await criarApp();
    ({ app, prisma, http } = c);
    [clube] = await criarClubesDeTeste(prisma, 'reacoes-lista', 1);
    tecnico = await cadastrarUsuario(c.post, prisma, clube, 'Técnico');
    [u1, u2, u3, admin] = [await cadastrarUsuario(c.post, prisma, null, 'Um'), await cadastrarUsuario(c.post, prisma, null, 'Dois'), await cadastrarUsuario(c.post, prisma, null, 'Três'), await cadastrarUsuario(c.post, prisma, null, 'Admin')];
    usuarios.push(tecnico.id, u1.id, u2.id, u3.id, admin.id);
    await prisma.user.update({ where: { id: admin.id }, data: { isAdmin: true } });
  });
  afterEach(() => prisma.post.deleteMany({ where: { clubId: clube } }));
  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: usuarios } } });
    await apagarClubesDeTeste(prisma, [clube]);
    await app.close();
  });

  it('agrupa por emoji (o mais usado primeiro) com id, nome, avatarUrl e clube de cada pessoa', async () => {
    const id = await novoPost();
    await reagir(id, u1, '🔥');
    await reagir(id, u2, '🔥');
    await reagir(id, u3, '❤️');
    await reagir(id, tecnico, '😂');
    await prisma.user.update({ where: { id: u1.id }, data: { avatarPath: '/uploads/avatares/a.jpg' } });
    const lista = (await com('get', `/api/posts/${id}/reacoes`, u3).expect(200)).body;
    expect(lista.map((g: { emoji: string }) => g.emoji)).toEqual(['🔥', '❤️', '😂']); // empate (1 e 1): ordem estável por emoji
    expect(lista[0].usuarios).toHaveLength(2);
    expect(lista[0].usuarios).toEqual(expect.arrayContaining([{ id: u1.id, nome: 'Um', avatarUrl: '/uploads/avatares/a.jpg', clube: null }, { id: u2.id, nome: 'Dois', avatarUrl: null, clube: null }]));
    expect(lista[2].usuarios).toEqual([{ id: tecnico.id, nome: 'Técnico', avatarUrl: null, clube: { id: clube, nome: expect.any(String), escudoUrl: '/escudos/generico.svg' } }]);
    expect(JSON.stringify(lista)).not.toMatch(/email|passwordHash/);
  });

  it('post sem reações → []; reação trocada aparece só no emoji novo', async () => {
    const id = await novoPost();
    expect((await com('get', `/api/posts/${id}/reacoes`, u1).expect(200)).body).toEqual([]);
    await reagir(id, u1, '🔥');
    await reagir(id, u1, '👏');
    const lista = (await com('get', `/api/posts/${id}/reacoes`, u1).expect(200)).body;
    expect(lista).toEqual([{ emoji: '👏', usuarios: [expect.objectContaining({ id: u1.id })] }]);
  });

  it('post oculto → 404 (menos para o admin); inexistente e id inválido → 404; sem sessão → 401', async () => {
    const id = await novoPost();
    await reagir(id, u1, '🔥');
    await com('put', `/api/admin/posts/${id}/ocultar`, admin).expect(204);
    await com('get', `/api/posts/${id}/reacoes`, u2).expect(404);
    await com('get', `/api/posts/${id}/reacoes`, tecnico).expect(404);
    expect((await com('get', `/api/posts/${id}/reacoes`, admin).expect(200)).body).toHaveLength(1);
    await com('get', '/api/posts/00000000-0000-4000-8000-000000000000/reacoes', u1).expect(404);
    await com('get', '/api/posts/nao-e-uuid/reacoes', u1).expect(404);
    await request(http()).get(`/api/posts/${id}/reacoes`).expect(401);
  });

  it('"ocultar para mim" não esconde a lista (acesso direto por id continua valendo)', async () => {
    const id = await novoPost();
    await reagir(id, u2, '🔥');
    await com('put', `/api/posts/${id}/ocultar-para-mim`, u1).expect(204);
    expect((await com('get', `/api/posts/${id}/reacoes`, u1).expect(200)).body).toHaveLength(1);
  });
});
