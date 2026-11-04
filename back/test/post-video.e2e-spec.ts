import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { PrismaService } from '../src/prisma.service.js';
import { arquivosEm, gerarAmostras } from './amostras.js';
import { apagarClubesDeTeste, cadastrarUsuario, criarApp, criarClubesDeTeste, ORIGIN } from './helpers.js';
import { montarJpeg } from './jpeg.js';

// Clubes teste-postvideo-N são só deste arquivo.
type U = { id: string; cookie: string[] };

describe('post com vídeo (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let post: Awaited<ReturnType<typeof criarApp>>['post'];
  let http: () => ReturnType<INestApplication['getHttpServer']>;
  let dir: string;
  let c: string[];
  let tecnico: U, outro: U, torcedor: U, admin: U;
  const usuarios: string[] = [];
  const amostras = gerarAmostras();
  const com = (m: 'get' | 'patch' | 'delete', url: string, u: U) => request(http())[m](url).set('Origin', ORIGIN).set('Cookie', u.cookie);
  const enviar = (u: U) => request(http()).post('/api/posts').set('Origin', ORIGIN).set('Cookie', u.cookie);
  const comVideo = (u: U) => enviar(u).field('legenda', 'Gol de placa').attach('video', amostras.hevcMov, 'iphone.mov');

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'im-postvideo-'));
    vi.stubEnv('UPLOADS_DIR', dir);
    ({ app, prisma, post, http } = await criarApp());
    c = await criarClubesDeTeste(prisma, 'postvideo', 2);
    tecnico = await cadastrarUsuario(post, prisma, c[0], 'Técnico Vídeo');
    outro = await cadastrarUsuario(post, prisma, c[1], 'Outro Vídeo');
    torcedor = await cadastrarUsuario(post, prisma, null, 'Torcedor Vídeo');
    admin = await cadastrarUsuario(post, prisma, null, 'Admin Vídeo');
    usuarios.push(tecnico.id, outro.id, torcedor.id, admin.id);
    await prisma.user.update({ where: { id: admin.id }, data: { isAdmin: true } });
  });
  afterEach(async () => {
    await prisma.post.deleteMany({ where: { authorId: { in: usuarios } } });
    await rm(dir, { recursive: true, force: true });
  });
  afterAll(async () => {
    vi.unstubAllEnvs();
    amostras.limpar();
    await prisma.user.deleteMany({ where: { id: { in: usuarios } } });
    await apagarClubesDeTeste(prisma, c);
    await rm(dir, { recursive: true, force: true });
    await app.close();
  });

  it('post com vídeo: 201 com capa, sem imagens, fora da galeria; igual no GET, no feed e na busca', async () => {
    const r = await comVideo(tecnico).expect(201);
    expect(r.body).toMatchObject({
      clube: { id: c[0] },
      legenda: 'Gol de placa',
      imagens: [],
      video: { url: expect.stringMatching(/^\/uploads\/videos\/[0-9a-f]{32}\.mp4$/), capaUrl: expect.stringMatching(/\.jpg$/), duracaoS: expect.any(Number), largura: 640, altura: 360 },
    });
    expect(r.body.video.duracaoS).toBeGreaterThan(1.5);
    expect(arquivosEm(dir).length).toBe(2); // mp4 + capa; o original (mov) não fica
    expect((await com('get', `/api/posts/${r.body.id}`, torcedor).expect(200)).body.video).toEqual(r.body.video);
    const feed = (await com('get', `/api/posts?clube=${c[0]}`, torcedor).expect(200)).body.itens as { id: string; video: unknown }[];
    expect(feed.find((p) => p.id === r.body.id)?.video).toEqual(r.body.video);
    const galeria = (await com('get', `/api/galeria?clube=${c[0]}`, torcedor).expect(200)).body.itens as unknown[];
    expect(galeria).toEqual([]);
    const busca = (await com('get', '/api/busca?q=placa&tipo=posts', torcedor).expect(200)).body.itens as { id: string }[];
    expect(busca.map((p) => p.id)).toContain(r.body.id);
  });

  it('post sem vídeo tem video: null', async () => {
    const r = await enviar(tecnico).send({ texto: 'Só texto' }).expect(201);
    expect(r.body.video).toBeNull();
  });

  it('imagens e vídeo juntos → 400; vídeo com texto → 400; nada fica no disco', async () => {
    await enviar(tecnico).field('legenda', 'x').attach('cheia', montarJpeg(100, 100), 'c.jpg').attach('mini', montarJpeg(50, 50), 'm.jpg').attach('video', amostras.hevcMov, 'v.mov').expect(400);
    await enviar(tecnico).field('texto', 'oi').attach('video', amostras.hevcMov, 'v.mov').expect(400);
    expect(arquivosEm(dir)).toEqual([]);
    expect(await prisma.post.count({ where: { authorId: tecnico.id } })).toBe(0);
  });

  it('31 s → 400 VIDEO_LONGO; texto .mp4 → 422 VIDEO_INVALIDO; 61 MB → 413; nada fica no disco', async () => {
    expect((await enviar(tecnico).attach('video', amostras.longo, 'l.mp4').expect(400)).body.codigo).toBe('VIDEO_LONGO');
    expect((await enviar(tecnico).attach('video', amostras.texto, 'f.mp4').expect(422)).body.codigo).toBe('VIDEO_INVALIDO');
    await enviar(tecnico).attach('video', amostras.grande, 'g.mp4').expect(413);
    expect(arquivosEm(dir)).toEqual([]);
    expect(await prisma.post.count({ where: { authorId: tecnico.id } })).toBe(0);
  });

  it('torcedor → 403 SEM_CLUBE; admin posta vídeo como CBF; legenda longa demais → 400 sem converter', async () => {
    expect((await comVideo(torcedor).expect(403)).body.codigo).toBe('SEM_CLUBE');
    const r = await enviar(admin).field('comoCbf', 'true').attach('video', amostras.hevcMov, 'v.mov').expect(201);
    expect(r.body.clube.id).toBe('cbf');
    await rm(dir, { recursive: true, force: true });
    await enviar(tecnico).field('legenda', 'x'.repeat(2201)).attach('video', amostras.hevcMov, 'v.mov').expect(400);
    expect(arquivosEm(dir)).toEqual([]);
  });

  it('editar a legenda do post de vídeo; texto nele → 400; só o técnico do clube edita', async () => {
    const p = (await comVideo(tecnico).expect(201)).body;
    const ed = await com('patch', `/api/posts/${p.id}`, tecnico).send({ legenda: 'Nova legenda' }).expect(200);
    expect(ed.body).toMatchObject({ legenda: 'Nova legenda', video: p.video });
    await com('patch', `/api/posts/${p.id}`, tecnico).send({ texto: 'oi' }).expect(400);
    await com('patch', `/api/posts/${p.id}`, outro).send({ legenda: 'invasor' }).expect(403);
  });

  it('apagar o post apaga o mp4 e a capa do disco', async () => {
    const p = (await comVideo(tecnico).expect(201)).body;
    expect(arquivosEm(dir).length).toBe(2);
    await com('delete', `/api/posts/${p.id}`, tecnico).expect(204);
    expect(arquivosEm(dir)).toEqual([]);
    expect(await prisma.postVideo.count({ where: { postId: p.id } })).toBe(0);
  });
});
