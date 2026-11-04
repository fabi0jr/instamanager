import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PostsEventos } from '../src/posts/posts.eventos.js';
import type { PrismaService } from '../src/prisma.service.js';
import { convite, criarApp, novoEmail, ORIGIN } from './helpers.js';
import { montarJpeg } from './jpeg.js';

// Clubes só deste arquivo (os e2e rodam em paralelo): vasco, vitoria, remo e mirassol.
describe('posts (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let post: Awaited<ReturnType<typeof criarApp>>['post'];
  let http: () => ReturnType<INestApplication['getHttpServer']>;
  let dir: string;
  const emails: string[] = [];
  const pngFalso = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  let ip = 0;

  const arquivosNoDisco = async (): Promise<string[]> => {
    const achar = async (d: string): Promise<string[]> => {
      const itens = await readdir(d, { withFileTypes: true }).catch(() => []);
      const filhos = await Promise.all(itens.map(async (i) => (i.isDirectory() ? achar(join(d, i.name)) : [join(d, i.name)])));
      return filhos.flat();
    };
    return achar(dir);
  };
  const cadastrar = async (clubeId: string | null) => {
    const email = novoEmail();
    emails.push(email);
    const res = await post('/api/auth/cadastro', { convite: await convite(prisma), email, senha: 'senha-boa-123', nome: `Nome ${clubeId ?? 'torcedor'}`, clubeId }, `10.5.0.${++ip}`).expect(201);
    return { id: res.body.id as string, cookie: res.headers['set-cookie'] as unknown as string[] };
  };
  type Usuario = Awaited<ReturnType<typeof cadastrar>>;
  const postar = (u: Usuario, o: { legenda?: string; prompts?: unknown; cheia?: Buffer[]; mini?: Buffer[] } = {}) => {
    const cheia = o.cheia ?? [montarJpeg(1600, 1200)];
    const mini = o.mini ?? cheia.map(() => montarJpeg(480, 360));
    const r = request(http()).post('/api/posts').set('Origin', ORIGIN).set('Cookie', u.cookie).field('legenda', o.legenda ?? 'Coletiva de hoje');
    r.field('prompts', JSON.stringify(o.prompts ?? cheia.map(() => null)));
    cheia.forEach((b, i) => r.attach('cheia', b, `c${i}.jpg`));
    mini.forEach((b, i) => r.attach('mini', b, `m${i}.jpg`));
    return r;
  };
  const com = (m: 'get' | 'patch' | 'delete', url: string, u: Usuario) => request(http())[m](url).set('Origin', ORIGIN).set('Cookie', u.cookie);

  let tecnico: Usuario, tecnico2: Usuario, torcedor: Usuario, admin: Usuario;

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'im-posts-'));
    vi.stubEnv('UPLOADS_DIR', dir);
    ({ app, prisma, post, http } = await criarApp());
    [tecnico, tecnico2, torcedor, admin] = [await cadastrar('vasco'), await cadastrar('vitoria'), await cadastrar(null), await cadastrar(null)];
    await prisma.user.update({ where: { id: admin.id }, data: { isAdmin: true } });
  });
  afterAll(async () => {
    vi.unstubAllEnvs();
    await prisma.post.deleteMany({ where: { OR: [{ clubId: { in: ['vasco', 'vitoria', 'remo', 'mirassol'] } }, { authorId: admin.id }] } });
    await prisma.user.deleteMany({ where: { email: { in: emails } } });
    await app.close();
    await rm(dir, { recursive: true, force: true });
  });

  it('torcedor posta → 403 SEM_CLUBE', async () => {
    const res = await postar(torcedor).expect(403);
    expect(res.body.codigo).toBe('SEM_CLUBE');
    expect(await arquivosNoDisco()).toEqual([]);
  });

  it('sem sessão → 401', async () => {
    await request(http()).post('/api/posts').set('Origin', ORIGIN).expect(401);
  });

  it('post com 11 imagens → 400 e nada no disco', async () => {
    const onze = Array.from({ length: 11 }, () => montarJpeg(10, 10));
    await postar(tecnico, { cheia: onze, mini: onze }).expect(400);
    expect(await arquivosNoDisco()).toEqual([]);
  });

  it('sem imagem, ou cheia[] e mini[] de tamanhos diferentes, ou prompts fora de ordem → 400', async () => {
    await postar(tecnico, { cheia: [], mini: [] }).expect(400);
    await postar(tecnico, { cheia: [montarJpeg(10, 10), montarJpeg(10, 10)], mini: [montarJpeg(10, 10)] }).expect(400);
    await postar(tecnico, { prompts: ['a', 'b'] }).expect(400); // 2 prompts para 1 imagem
    await postar(tecnico, { prompts: 'não é lista' }).expect(400);
    expect(await arquivosNoDisco()).toEqual([]);
  });

  it('arquivo PNG renomeado → 400 IMAGEM_INVALIDA e nada gravado, nem as imagens boas que vinham antes', async () => {
    const boa = montarJpeg(1600, 1200);
    const res = await postar(tecnico, { cheia: [boa, pngFalso], mini: [montarJpeg(480, 360), montarJpeg(480, 360)] }).expect(400);
    expect(res.body.codigo).toBe('IMAGEM_INVALIDA');
    const res2 = await postar(tecnico, { cheia: [boa], mini: [pngFalso] }).expect(400);
    expect(res2.body.codigo).toBe('IMAGEM_INVALIDA');
    expect(await arquivosNoDisco()).toEqual([]);
    expect(await prisma.post.count({ where: { clubId: 'vasco' } })).toBe(0);
  });

  it('arquivo > 3 MB → 413', async () => {
    await postar(tecnico, { cheia: [montarJpeg(1600, 1200, 3 * 1024 * 1024)] }).expect(413);
    expect(await arquivosNoDisco()).toEqual([]);
  });

  it('técnico posta: 201 com o Post completo, arquivos gravados e evento posts.criado', async () => {
    const eventos = app.get(PostsEventos);
    const ouvido: string[] = [];
    eventos.on('posts.criado', (id: string) => ouvido.push(id));
    const res = await postar(tecnico, { legenda: 'Novo reforço', prompts: ['um prompt', null], cheia: [montarJpeg(1600, 1200), montarJpeg(900, 1600)] }).expect(201);
    expect(res.body).toMatchObject({
      clube: { id: 'vasco', nome: 'Vasco da Gama', escudoUrl: '/escudos/vasco.svg' },
      autor: { id: tecnico.id },
      legenda: 'Novo reforço',
      curtidas: 0,
      curtiu: false,
      comentarios: 0,
      podeEditar: true,
    });
    expect(res.body.imagens).toHaveLength(2);
    expect(res.body.imagens[0]).toMatchObject({ largura: 1600, altura: 1200, prompt: 'um prompt' });
    expect(res.body.imagens[1]).toMatchObject({ largura: 900, altura: 1600, prompt: null });
    expect(res.body.imagens[0].miniUrl).toMatch(/^\/uploads\/posts\/[0-9a-f]{32}\.jpg$/);
    expect(await arquivosNoDisco()).toHaveLength(4);
    await vi.waitFor(() => expect(ouvido).toEqual([res.body.id]));
  });

  describe('feed', () => {
    it('pagina por cursor: 13 posts → 12 + proximo, depois 1 + null (com empate de criadoEm)', async () => {
      const base = Date.parse('2026-06-01T12:00:00.000Z');
      const ids: string[] = [];
      for (let i = 0; i < 13; i++) {
        // os dois mais antigos têm o mesmo criadoEm: o desempate é pelo id
        const t = new Date(base + Math.max(i, 1) * 1000);
        const p = await prisma.post.create({ data: { clubId: 'remo', authorId: tecnico.id, caption: `p${i}`, createdAt: t } });
        ids.push(p.id);
      }
      const pg1 = await com('get', '/api/posts?clube=remo', torcedor).expect(200);
      expect(pg1.body.itens).toHaveLength(12);
      expect(pg1.body.proximo).toEqual(expect.any(String));
      const pg2 = await com('get', `/api/posts?clube=remo&antes=${pg1.body.proximo}`, torcedor).expect(200);
      expect(pg2.body.itens).toHaveLength(1);
      expect(pg2.body.proximo).toBeNull();
      const vistos = [...pg1.body.itens, ...pg2.body.itens].map((p: { id: string }) => p.id);
      expect(new Set(vistos).size).toBe(13);
      expect([...vistos].sort()).toEqual([...ids].sort());
      expect(pg1.body.itens[0].legenda).toBe('p12'); // mais novo primeiro
    });

    it('cursor inválido → 400; ?clube= filtra', async () => {
      await com('get', '/api/posts?antes=lixo', torcedor).expect(400);
      const res = await com('get', '/api/posts?clube=vasco', torcedor).expect(200);
      expect(res.body.itens.every((p: { clube: { id: string } }) => p.clube.id === 'vasco')).toBe(true);
    });

    it('curtidas, curtiu e comentarios refletem o banco', async () => {
      const p = await prisma.post.create({ data: { clubId: 'remo', authorId: tecnico.id, caption: 'contagens' } });
      await prisma.like.create({ data: { postId: p.id, userId: torcedor.id } });
      await prisma.comment.create({ data: { postId: p.id, userId: torcedor.id, text: 'oi' } });
      const eu = (await com('get', `/api/posts/${p.id}`, torcedor).expect(200)).body;
      expect(eu).toMatchObject({ curtidas: 1, curtiu: true, comentarios: 1, podeEditar: false });
      const outro = (await com('get', `/api/posts/${p.id}`, tecnico).expect(200)).body;
      expect(outro).toMatchObject({ curtidas: 1, curtiu: false, comentarios: 1 });
    });
  });

  describe('edição e exclusão', () => {
    it('após troca de técnico, ex-técnico PATCH → 403 NAO_E_TECNICO e novo técnico PATCH → 200', async () => {
      const exTecnico = tecnico2;
      const novo = await cadastrar(null);
      const criado = (await postar(exTecnico, { prompts: ['antigo'] }).expect(201)).body;
      expect(criado.podeEditar).toBe(true);
      await prisma.club.update({ where: { id: 'vitoria' }, data: { coachId: null } });
      await prisma.club.update({ where: { id: 'vitoria' }, data: { coachId: novo.id } });

      const negado = await com('patch', `/api/posts/${criado.id}`, exTecnico).send({ legenda: 'tentei' }).expect(403);
      expect(negado.body.codigo).toBe('NAO_E_TECNICO');
      expect((await com('get', `/api/posts/${criado.id}`, exTecnico).expect(200)).body.podeEditar).toBe(false);

      const ok = await com('patch', `/api/posts/${criado.id}`, novo).send({ legenda: 'nova legenda', prompts: ['novo prompt'] }).expect(200);
      expect(ok.body.legenda).toBe('nova legenda');
      expect(ok.body.imagens[0].prompt).toBe('novo prompt');
      expect(ok.body.autor.id).toBe(exTecnico.id); // continua "por" quem publicou
    });

    it('PATCH com prompts de tamanho errado ou legenda > 2200 → 400', async () => {
      const p = (await postar(tecnico).expect(201)).body;
      await com('patch', `/api/posts/${p.id}`, tecnico).send({ prompts: ['a', 'b'] }).expect(400);
      await com('patch', `/api/posts/${p.id}`, tecnico).send({ legenda: 'x'.repeat(2201) }).expect(400);
    });

    it('post inexistente → 404 NAO_ENCONTRADO', async () => {
      const res = await com('get', '/api/posts/00000000-0000-4000-8000-000000000000', torcedor).expect(404);
      expect(res.body.codigo).toBe('NAO_ENCONTRADO');
      await com('get', '/api/posts/nao-e-uuid', torcedor).expect(404);
    });

    it('admin DELETE post de outro → 204 e arquivos apagados; torcedor não apaga', async () => {
      const antes = (await arquivosNoDisco()).length;
      const p = (await postar(tecnico, { cheia: [montarJpeg(10, 10), montarJpeg(20, 20)] }).expect(201)).body;
      expect(await arquivosNoDisco()).toHaveLength(antes + 4);
      expect((await com('get', `/api/posts/${p.id}`, admin).expect(200)).body.podeEditar).toBe(true);
      await com('delete', `/api/posts/${p.id}`, torcedor).expect(403);
      await com('delete', `/api/posts/${p.id}`, admin).expect(204);
      expect(await arquivosNoDisco()).toHaveLength(antes);
      await com('get', `/api/posts/${p.id}`, admin).expect(404);
      expect(await prisma.postImage.count({ where: { postId: p.id } })).toBe(0);
    });
  });

  describe('galeria', () => {
    it('só traz imagens com prompt, com clube, e pagina por cursor', async () => {
      const p = await prisma.post.create({
        data: {
          clubId: 'mirassol',
          authorId: tecnico.id,
          caption: 'g',
          images: {
            create: [
              { position: 0, fullPath: '/uploads/posts/a.jpg', thumbPath: '/uploads/posts/a-m.jpg', width: 1, height: 1, prompt: 'prompt A' },
              { position: 1, fullPath: '/uploads/posts/b.jpg', thumbPath: '/uploads/posts/b-m.jpg', width: 1, height: 1, prompt: null },
              { position: 2, fullPath: '/uploads/posts/c.jpg', thumbPath: '/uploads/posts/c-m.jpg', width: 1, height: 1, prompt: 'prompt C' },
            ],
          },
        },
      });
      const res = await com('get', '/api/galeria?clube=mirassol', torcedor).expect(200);
      expect(res.body.proximo).toBeNull();
      expect(res.body.itens).toHaveLength(2);
      expect(res.body.itens.map((i: { prompt: string }) => i.prompt).sort((a: string, b: string) => a.localeCompare(b))).toEqual(['prompt A', 'prompt C']);
      expect(res.body.itens[0]).toMatchObject({ postId: p.id, clube: { id: 'mirassol', nome: 'Mirassol' } });
      expect(res.body.itens[0].miniUrl).toMatch(/^\/uploads\/posts\//);

      // mais de uma página: 25 imagens com prompt → 24 + 1
      await prisma.postImage.createMany({
        data: Array.from({ length: 23 }, (_, i) => ({ postId: p.id, position: 10 + i, fullPath: `/f${i}`, thumbPath: `/t${i}`, width: 1, height: 1, prompt: `x${i}` })),
      });
      const pg1 = await com('get', '/api/galeria?clube=mirassol', torcedor).expect(200);
      expect(pg1.body.itens).toHaveLength(24);
      const pg2 = await com('get', `/api/galeria?clube=mirassol&antes=${pg1.body.proximo}`, torcedor).expect(200);
      expect(pg2.body.itens).toHaveLength(1);
      expect(pg2.body.proximo).toBeNull();
    });
  });

  it('admin sem clube posta como CBF (comoCbf=true); sem comoCbf continua SEM_CLUBE', async () => {
    const texto = (extra: object) => request(http()).post('/api/posts').set('Origin', ORIGIN).set('Cookie', admin.cookie).send({ texto: 'Nota da CBF', ...extra });
    const ok = await texto({ comoCbf: true }).expect(201);
    expect(ok.body.clube.id).toBe('cbf');
    const sem = await texto({}).expect(403);
    expect(sem.body.codigo).toBe('SEM_CLUBE');
  });
});
