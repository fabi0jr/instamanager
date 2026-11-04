import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { PrismaService } from '../src/prisma.service.js';
import { apagarClubesDeTeste, cadastrarUsuario, criarApp, criarClubesDeTeste, ORIGIN } from './helpers.js';

// Clubes teste-busca-N são só deste arquivo (os e2e rodam em paralelo no mesmo banco).
type U = { id: string; cookie: string[] };
type Res = { itens: { id: string; [k: string]: unknown }[]; proximo: string | null };

describe('busca (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let post: Awaited<ReturnType<typeof criarApp>>['post'];
  let http: () => ReturnType<INestApplication['getHttpServer']>;
  let c: string[];
  let tecnico: U, outro: U, torcedor: U, admin: U;
  const usuarios: string[] = [];
  const com = (m: 'get' | 'put' | 'delete', url: string, u: U) => request(http())[m](url).set('Origin', ORIGIN).set('Cookie', u.cookie);
  const busca = (q: string, tipo: string, u: U = torcedor, extra = '') => com('get', `/api/busca?q=${encodeURIComponent(q)}&tipo=${tipo}${extra}`, u);
  const ok = async (q: string, tipo: string, u: U = torcedor) => (await busca(q, tipo, u).expect(200)).body as Res;
  const postar = async (u: U, texto: string) => (await request(http()).post('/api/posts').set('Origin', ORIGIN).set('Cookie', u.cookie).send({ texto }).expect(201)).body as { id: string };

  beforeAll(async () => {
    ({ app, prisma, post, http } = await criarApp());
    c = await criarClubesDeTeste(prisma, 'busca', 2);
    await prisma.club.update({ where: { id: c[1] }, data: { name: 'Teste Contratação FC' } });
    tecnico = await cadastrarUsuario(post, prisma, c[0], 'Técnico Búsqueda');
    outro = await cadastrarUsuario(post, prisma, null, 'Pessoa Qualquer');
    torcedor = await cadastrarUsuario(post, prisma, null, 'Torcedor Busca');
    admin = await cadastrarUsuario(post, prisma, null, 'Admin Busca');
    usuarios.push(tecnico.id, outro.id, torcedor.id, admin.id);
    await prisma.user.update({ where: { id: admin.id }, data: { isAdmin: true } });
  });
  afterEach(async () => {
    await prisma.post.deleteMany({ where: { authorId: { in: usuarios } } });
  });
  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: usuarios } } });
    await apagarClubesDeTeste(prisma, c);
    await app.close();
  });

  it("'contratacao' acha 'Contratação' (sem acento, sem diferenciar maiúsculas) em posts", async () => {
    const p = await postar(tecnico, 'Grande CONTRATAÇÃO do ano');
    await postar(tecnico, 'Nada a ver');
    const r = await ok('contratacao', 'posts');
    expect(r.itens.map((i) => i.id)).toEqual([p.id]);
    expect(r.itens[0]).toMatchObject({ texto: 'Grande CONTRATAÇÃO do ano', clube: { id: c[0] }, podeEditar: false });
    expect(r.proximo).toBeNull();
  });

  it('valida q (2 a 60 caracteres) e tipo → 400', async () => {
    expect((await busca('a', 'posts').expect(400)).body.codigo).toBe('DADOS_INVALIDOS');
    await busca('  a  ', 'posts').expect(400);
    await busca('', 'posts').expect(400);
    await busca('x'.repeat(61), 'posts').expect(400);
    await busca('ok', 'lixo').expect(400);
    await busca('ok', 'posts').expect(200);
    await request(http()).get('/api/busca?q=oi&tipo=posts').set('Origin', ORIGIN).expect(401);
  });

  it("'%' e '_' valem como texto; aspas e SQL malicioso não dão erro", async () => {
    const p = await postar(tecnico, 'Desconto de 50% hoje_mesmo');
    await postar(tecnico, 'Cinquenta por cento');
    expect((await ok('50%', 'posts')).itens.map((i) => i.id)).toEqual([p.id]);
    expect((await ok('e_m', 'posts')).itens.map((i) => i.id)).toEqual([p.id]);
    expect((await ok('%%', 'posts')).itens).toEqual([]);
    expect((await ok('__', 'posts')).itens).toEqual([]);
    expect((await ok('a\\', 'posts')).itens).toEqual([]);
    for (const tipo of ['posts', 'prompts', 'clubes', 'pessoas']) {
      expect((await ok("'; drop table \"Post\"; --", tipo)).itens).toEqual([]);
      expect((await ok('"quoted" \'q\'', tipo)).itens).toEqual([]);
    }
    expect(await prisma.post.count({ where: { authorId: tecnico.id } })).toBe(2);
  });

  it('post ocultado fica fora da busca (o admin ainda acha); post que a pessoa ocultou para si também', async () => {
    const p = await postar(tecnico, 'Frase única zebra');
    expect((await ok('zebra', 'posts')).itens).toHaveLength(1);
    await com('put', `/api/admin/posts/${p.id}/ocultar`, admin).expect(204);
    expect((await ok('zebra', 'posts')).itens).toEqual([]);
    expect((await ok('zebra', 'posts', admin)).itens).toHaveLength(1);
    await com('delete', `/api/admin/posts/${p.id}/ocultar`, admin).expect(204);
    await com('put', `/api/posts/${p.id}/ocultar-para-mim`, torcedor).expect(204);
    expect((await ok('zebra', 'posts')).itens).toEqual([]);
    expect((await ok('zebra', 'posts', outro)).itens).toHaveLength(1);
  });

  it('prompts: acha pelo prompt da imagem (formato da galeria), só de post visível', async () => {
    const p = await postar(tecnico, 'Post com imagem');
    const img = await prisma.postImage.create({ data: { postId: p.id, position: 0, fullPath: '/uploads/posts/a.jpg', thumbPath: '/uploads/posts/b.jpg', width: 10, height: 10, prompt: 'Um leão com CAPA vermelha' } });
    const r = await ok('capa vermelha', 'prompts');
    expect(r.itens).toEqual([{ imagemId: img.id, postId: p.id, miniUrl: '/uploads/posts/b.jpg', cheiaUrl: '/uploads/posts/a.jpg', prompt: 'Um leão com CAPA vermelha', clube: { id: c[0], nome: expect.any(String), escudoUrl: expect.any(String) }, favorito: false }]);
    expect((await ok('leão', 'posts')).itens).toEqual([]); // o prompt não entra na busca de posts
    await com('put', `/api/admin/posts/${p.id}/ocultar`, admin).expect(204);
    expect((await ok('capa vermelha', 'prompts')).itens).toEqual([]);
  });

  it('clubes: acha por nome sem acento, traz o técnico, nunca a CBF', async () => {
    const r = await ok('contratacao', 'clubes');
    expect(r.itens).toEqual([{ id: c[1], nome: 'Teste Contratação FC', escudoUrl: '/escudos/generico.svg', tecnico: null }]);
    await prisma.club.update({ where: { id: c[0] }, data: { name: 'Teste Busca Um' } });
    expect((await ok('busca um', 'clubes')).itens).toEqual([{ id: c[0], nome: 'Teste Busca Um', escudoUrl: '/escudos/generico.svg', tecnico: { id: tecnico.id, nome: 'Técnico Búsqueda' } }]);
    expect((await ok('cbf', 'clubes')).itens).toEqual([]);
  });

  it('pessoas: como /pessoas (sem acento, com o clube, sem e-mail)', async () => {
    const r = await ok('busqueda', 'pessoas');
    expect(r.itens).toEqual([{ id: tecnico.id, nome: 'Técnico Búsqueda', avatarUrl: null, clube: { id: c[0], nome: expect.any(String), escudoUrl: '/escudos/generico.svg' } }]);
    expect(JSON.stringify(r)).not.toContain('@');
  });

  it('paginação de 20 em 20, sem repetir (posts e pessoas)', async () => {
    await prisma.post.createMany({ data: Array.from({ length: 25 }, (_, i) => ({ clubId: c[0], authorId: tecnico.id, caption: '', texto: `paginavel ${i}` })) });
    const a = await ok('paginavel', 'posts');
    expect(a.itens).toHaveLength(20);
    const b = (await busca('paginavel', 'posts', torcedor, `&antes=${a.proximo}`).expect(200)).body as Res;
    expect(b.itens).toHaveLength(5);
    expect(b.proximo).toBeNull();
    expect(new Set([...a.itens, ...b.itens].map((i) => i.id)).size).toBe(25);
    await busca('paginavel', 'posts', torcedor, '&antes=lixo').expect(400);

    const extras = await Promise.all(Array.from({ length: 22 }, (_, i) => cadastrarUsuario(post, prisma, null, `Zzbusca ${String(i).padStart(2, '0')}`)));
    usuarios.push(...extras.map((e) => e.id));
    const pa = await ok('zzbusca', 'pessoas');
    expect(pa.itens).toHaveLength(20);
    const pb = (await busca('zzbusca', 'pessoas', torcedor, `&antes=${pa.proximo}`).expect(200)).body as Res;
    expect(pb.itens).toHaveLength(2);
    expect(pb.proximo).toBeNull();
    expect(new Set([...pa.itens, ...pb.itens].map((i) => i.id)).size).toBe(22);
    await busca('zzbusca', 'pessoas', torcedor, '&antes=-3').expect(400);
  });
});
