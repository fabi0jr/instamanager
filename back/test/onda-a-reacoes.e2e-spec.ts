import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { PrismaService } from '../src/prisma.service.js';
import { cadastrarUsuario, criarApp, ORIGIN } from './helpers.js';
import { montarJpeg } from './jpeg.js';

// Clube só deste arquivo (os e2e rodam em paralelo): palmeiras.
describe('onda A · reações, posts de texto e fixados (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let post: Awaited<ReturnType<typeof criarApp>>['post'];
  let http: () => ReturnType<INestApplication['getHttpServer']>;
  type U = Awaited<ReturnType<typeof cadastrarUsuario>>;
  let tecnico: U, torcedor: U, outro: U, admin: U;
  const ids: string[] = [];
  const com = (m: 'get' | 'put' | 'post' | 'delete', url: string, u: U) => request(http())[m](url).set('Origin', ORIGIN).set('Cookie', u.cookie);
  const postarTexto = (u: U, texto?: string) => {
    const r = com('post', '/api/posts', u);
    return texto === undefined ? r.field('legenda', '') : r.field('texto', texto);
  };
  const novoPost = async (extra: object = {}) => (await prisma.post.create({ data: { clubId: 'palmeiras', authorId: tecnico.id, caption: 'p', ...extra } })).id;
  const obter = async (id: string, u: U) => (await com('get', `/api/posts/${id}`, u).expect(200)).body;

  beforeAll(async () => {
    ({ app, prisma, post, http } = await criarApp());
    tecnico = await cadastrarUsuario(post, prisma, 'palmeiras', 'Técnico');
    [torcedor, outro, admin] = [await cadastrarUsuario(post, prisma, null, 'Torcedor'), await cadastrarUsuario(post, prisma, null, 'Outro'), await cadastrarUsuario(post, prisma, null, 'Admin')];
    ids.push(tecnico.id, torcedor.id, outro.id, admin.id);
    await prisma.user.update({ where: { id: admin.id }, data: { isAdmin: true } });
  });
  afterEach(() => prisma.post.deleteMany({ where: { clubId: 'palmeiras' } }));
  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await app.close();
  });

  describe('reações', () => {
    it('curtida existente (criada antes da migração) aparece como ❤️ com mesma contagem', async () => {
      const id = await novoPost();
      // INSERT como o código antigo fazia: sem a coluna emoji
      await prisma.$executeRaw`INSERT INTO "Like" ("postId","userId") VALUES (${id}::uuid, ${torcedor.id}::uuid), (${id}::uuid, ${outro.id}::uuid)`;
      expect(await obter(id, torcedor)).toMatchObject({ curtidas: 2, curtiu: true, minhaReacao: '❤️', reacoes: [{ emoji: '❤️', total: 2 }] });
    });

    it('reagir 🔥 depois ❤️ troca, total continua 1', async () => {
      const id = await novoPost();
      await com('put', `/api/posts/${id}/reacao`, torcedor).send({ emoji: '🔥' }).expect(204);
      expect(await obter(id, torcedor)).toMatchObject({ curtidas: 1, minhaReacao: '🔥', reacoes: [{ emoji: '🔥', total: 1 }] });
      await com('put', `/api/posts/${id}/reacao`, torcedor).send({ emoji: '❤️' }).expect(204);
      expect(await obter(id, torcedor)).toMatchObject({ curtidas: 1, curtiu: true, minhaReacao: '❤️', reacoes: [{ emoji: '❤️', total: 1 }] });
      await com('delete', `/api/posts/${id}/reacao`, torcedor).expect(204);
      await com('delete', `/api/posts/${id}/reacao`, torcedor).expect(204);
      expect(await obter(id, torcedor)).toMatchObject({ curtidas: 0, curtiu: false, minhaReacao: null, reacoes: [] });
    });

    it('reacoes traz até 3 emojis, o mais usado primeiro; curtida (apelido) vira ❤️', async () => {
      const id = await novoPost();
      await com('put', `/api/posts/${id}/reacao`, torcedor).send({ emoji: '🔥' }).expect(204);
      await com('put', `/api/posts/${id}/reacao`, outro).send({ emoji: '🔥' }).expect(204);
      await com('put', `/api/posts/${id}/reacao`, admin).send({ emoji: '😂' }).expect(204);
      await com('put', `/api/posts/${id}/reacao`, tecnico).send({ emoji: '👏' }).expect(204);
      const p = await obter(id, admin);
      expect(p.reacoes).toHaveLength(3);
      expect(p.reacoes[0]).toEqual({ emoji: '🔥', total: 2 });
      expect(p.curtidas).toBe(4);
      await com('put', `/api/posts/${id}/curtida`, torcedor).expect(204);
      expect(await obter(id, torcedor)).toMatchObject({ minhaReacao: '❤️', curtidas: 4 });
      await com('delete', `/api/posts/${id}/curtida`, torcedor).expect(204);
      expect((await obter(id, torcedor)).minhaReacao).toBeNull();
    });

    it('emoji fora da lista → 400 EMOJI_INVALIDO; post inexistente → 404', async () => {
      const id = await novoPost();
      for (const emoji of ['🤡', '', 7, undefined])
        expect((await com('put', `/api/posts/${id}/reacao`, torcedor).send({ emoji }).expect(400)).body.codigo).toBe('EMOJI_INVALIDO');
      await com('put', '/api/posts/00000000-0000-4000-8000-000000000000/reacao', torcedor).send({ emoji: '🔥' }).expect(404);
    });
  });

  describe('posts de texto', () => {
    it("0 arquivos + 'Rodada boa' → 201 com texto e imagens []", async () => {
      const res = await postarTexto(tecnico, 'Rodada boa').expect(201);
      expect(res.body).toMatchObject({ texto: 'Rodada boa', imagens: [], legenda: '', fixado: false, reacoes: [], minhaReacao: null });
      expect(await obter(res.body.id, torcedor)).toMatchObject({ texto: 'Rodada boa' });
    });

    it('texto de 500 → 201; 501 → 400', async () => {
      await postarTexto(tecnico, 'x'.repeat(500)).expect(201);
      await postarTexto(tecnico, 'x'.repeat(501)).expect(400);
    });

    it('0 arquivos sem texto (ou só espaços) → 400; torcedor sem clube → 403', async () => {
      await postarTexto(tecnico).expect(400);
      await postarTexto(tecnico, '   ').expect(400);
      await postarTexto(torcedor, 'oi').expect(403);
    });

    it('post com imagem continua com texto null', async () => {
      const r = com('post', '/api/posts', tecnico).field('legenda', 'foto').field('prompts', '[null]').attach('cheia', montarJpeg(800, 600), 'c.jpg').attach('mini', montarJpeg(480, 360), 'm.jpg');
      expect((await r.expect(201)).body).toMatchObject({ texto: null, legenda: 'foto' });
    });

    it('galeria não lista post de texto', async () => {
      const res = await postarTexto(tecnico, 'Só texto').expect(201);
      const g = (await com('get', '/api/galeria?clube=palmeiras', torcedor).expect(200)).body;
      expect(g.itens.map((i: { postId: string }) => i.postId)).not.toContain(res.body.id);
    });
  });

  describe('fixados', () => {
    const fixar = (id: string, u: U, m: 'put' | 'delete' = 'put') => com(m, `/api/admin/posts/${id}/fixar`, u);

    it('admin fixa 3, o 4º → 409 LIMITE_FIXADOS; desafixar libera vaga', async () => {
      const [a, b, c, d] = [await novoPost(), await novoPost(), await novoPost(), await novoPost()];
      for (const id of [a, b, c]) await fixar(id, admin).expect(204);
      await fixar(c, admin).expect(204); // fixar de novo o que já está fixado não conta
      expect((await fixar(d, admin).expect(409)).body.codigo).toBe('LIMITE_FIXADOS');
      await fixar(a, admin, 'delete').expect(204);
      await fixar(d, admin).expect(204);
      expect((await obter(d, torcedor)).fixado).toBe(true);
      expect((await obter(a, torcedor)).fixado).toBe(false);
    });

    it('não-admin fixar → 403; post inexistente → 404', async () => {
      const id = await novoPost();
      await fixar(id, tecnico).expect(403);
      await fixar(id, torcedor, 'delete').expect(403);
      await fixar('00000000-0000-4000-8000-000000000000', admin).expect(404);
    });

    it('feed pág. 1 traz fixados (pinnedAt desc) e não os repete em itens', async () => {
      const antigo = await novoPost({ createdAt: new Date(Date.now() - 3600_000) });
      const f2 = await novoPost();
      const solto = await novoPost();
      await fixar(antigo, admin).expect(204);
      await fixar(f2, admin).expect(204);
      const feed = (await com('get', '/api/posts', torcedor).expect(200)).body;
      expect(feed.fixados.map((p: { id: string }) => p.id)).toEqual([f2, antigo]);
      expect(feed.fixados[0].fixado).toBe(true);
      const nosItens = feed.itens.map((p: { id: string }) => p.id);
      expect(nosItens).not.toContain(antigo);
      expect(nosItens).not.toContain(f2);
      expect(nosItens).toContain(solto);
    });

    it('com ?clube= ou ?antes= não traz fixados (campo ausente)', async () => {
      const id = await novoPost();
      await fixar(id, admin).expect(204);
      expect((await com('get', '/api/posts?clube=palmeiras', torcedor).expect(200)).body.fixados).toBeUndefined();
      const itens = (await com('get', '/api/posts?clube=palmeiras', torcedor).expect(200)).body.itens;
      expect(itens.map((p: { id: string }) => p.id)).toContain(id);
    });

    it('apagar post fixado tira dos fixados', async () => {
      const id = await novoPost();
      await fixar(id, admin).expect(204);
      await com('delete', `/api/posts/${id}`, tecnico).expect(204);
      expect((await com('get', '/api/posts', torcedor).expect(200)).body.fixados.map((p: { id: string }) => p.id)).not.toContain(id);
      // a vaga volta: dá para fixar 3 outros
      for (let i = 0; i < 3; i++) await fixar(await novoPost(), admin).expect(204);
    });
  });
});
