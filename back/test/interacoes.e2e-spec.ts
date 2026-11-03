import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { InteracoesEventos } from '../src/interacoes/interacoes.eventos.js';
import type { PrismaService } from '../src/prisma.service.js';
import { cadastrarUsuario, criarApp, ORIGIN } from './helpers.js';

// Clube só deste arquivo (os e2e rodam em paralelo): coritiba.
describe('curtidas e comentários (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let post: Awaited<ReturnType<typeof criarApp>>['post'];
  let http: () => ReturnType<INestApplication['getHttpServer']>;
  type U = Awaited<ReturnType<typeof cadastrarUsuario>>;
  let tecnico: U, torcedor: U, outro: U, admin: U;
  let postId: string;
  const ids: string[] = [];
  const com = (m: 'get' | 'put' | 'post' | 'delete', url: string, u: U) => request(http())[m](url).set('Origin', ORIGIN).set('Cookie', u.cookie);

  beforeAll(async () => {
    ({ app, prisma, post, http } = await criarApp());
    tecnico = await cadastrarUsuario(post, prisma, 'coritiba', 'Técnico');
    [torcedor, outro, admin] = [await cadastrarUsuario(post, prisma, null, 'Torcedor'), await cadastrarUsuario(post, prisma, null, 'Outro'), await cadastrarUsuario(post, prisma, null, 'Admin')];
    ids.push(tecnico.id, torcedor.id, outro.id, admin.id);
    await prisma.user.update({ where: { id: admin.id }, data: { isAdmin: true } });
    postId = (await prisma.post.create({ data: { clubId: 'coritiba', authorId: tecnico.id, caption: 'p' } })).id;
  });
  afterAll(async () => {
    await prisma.post.deleteMany({ where: { clubId: 'coritiba' } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await app.close();
  });

  const post_ = async (u: U) => (await com('get', `/api/posts/${postId}`, u).expect(200)).body;

  describe('curtidas', () => {
    it('curtir duas vezes conta 1; descurtir duas vezes não falha', async () => {
      await com('put', `/api/posts/${postId}/curtida`, torcedor).expect(204);
      await com('put', `/api/posts/${postId}/curtida`, torcedor).expect(204);
      expect(await post_(torcedor)).toMatchObject({ curtidas: 1, curtiu: true });
      expect(await post_(outro)).toMatchObject({ curtidas: 1, curtiu: false });
      await com('delete', `/api/posts/${postId}/curtida`, torcedor).expect(204);
      await com('delete', `/api/posts/${postId}/curtida`, torcedor).expect(204);
      expect(await post_(torcedor)).toMatchObject({ curtidas: 0, curtiu: false });
    });

    it('curtidas simultâneas da mesma pessoa contam 1', async () => {
      await Promise.all([1, 2, 3].map(() => com('put', `/api/posts/${postId}/curtida`, outro).expect(204)));
      expect((await post_(outro)).curtidas).toBe(1);
      await com('delete', `/api/posts/${postId}/curtida`, outro).expect(204);
    });

    it('post inexistente → 404; sem sessão → 401', async () => {
      await com('put', '/api/posts/00000000-0000-4000-8000-000000000000/curtida', torcedor).expect(404);
      await request(http()).put(`/api/posts/${postId}/curtida`).set('Origin', ORIGIN).expect(401);
    });
  });

  describe('comentários', () => {
    it('comentário de 1001 chars → 400; vazio → 400; 1000 chars → 201', async () => {
      await com('post', `/api/posts/${postId}/comentarios`, torcedor).send({ texto: 'x'.repeat(1001) }).expect(400);
      await com('post', `/api/posts/${postId}/comentarios`, torcedor).send({ texto: '   ' }).expect(400);
      await com('post', `/api/posts/${postId}/comentarios`, torcedor).send({}).expect(400);
      const ok = await com('post', `/api/posts/${postId}/comentarios`, torcedor).send({ texto: 'x'.repeat(1000) }).expect(201);
      await com('delete', `/api/comentarios/${ok.body.id}`, torcedor).expect(204);
    });

    it('cria (201), emite comentarios.criado e entra na contagem do post', async () => {
      const ouvidos: string[] = [];
      app.get(InteracoesEventos).on('comentarios.criado', (id: string) => ouvidos.push(id));
      const antes = (await post_(torcedor)).comentarios;
      const res = await com('post', `/api/posts/${postId}/comentarios`, torcedor).send({ texto: ' Que time! ' }).expect(201);
      expect(res.body).toMatchObject({ texto: 'Que time!', usuario: { id: torcedor.id, nome: 'Torcedor', avatarUrl: null, clube: null } });
      await vi.waitFor(() => expect(ouvidos).toEqual([res.body.id]));
      expect((await post_(torcedor)).comentarios).toBe(antes + 1);
    });

    it('comentário mostra a tag do clube atual de quem comentou (muda com o clube)', async () => {
      const quem = await cadastrarUsuario(post, prisma, null, 'Ex-torcedor');
      ids.push(quem.id);
      await com('post', `/api/posts/${postId}/comentarios`, quem).send({ texto: 'meu comentário' }).expect(201);
      const achar = async () => (await com('get', `/api/posts/${postId}/comentarios`, tecnico).expect(200)).body.find((c: { usuario: { id: string } }) => c.usuario.id === quem.id);
      expect((await achar()).usuario.clube).toBeNull();
      // vira técnico depois de comentar (o técnico anterior do coritiba sai): a tag acompanha o clube atual
      await prisma.club.update({ where: { id: 'coritiba' }, data: { coachId: quem.id } });
      expect((await achar()).usuario.clube).toEqual({ id: 'coritiba', nome: 'Coritiba' });
      await prisma.club.update({ where: { id: 'coritiba' }, data: { coachId: tecnico.id } });
    });

    it('lista do mais velho ao mais novo', async () => {
      const lista = (await com('get', `/api/posts/${postId}/comentarios`, torcedor).expect(200)).body as { criadoEm: string }[];
      expect(lista.length).toBeGreaterThanOrEqual(2);
      const tempos = lista.map((c) => Date.parse(c.criadoEm));
      expect(tempos).toEqual([...tempos].sort((a, b) => a - b));
    });

    it('apagar: autor 204, outro 403, admin 204 (de qualquer um), depois 404', async () => {
      const meu = (await com('post', `/api/posts/${postId}/comentarios`, torcedor).send({ texto: 'meu' }).expect(201)).body.id;
      await com('delete', `/api/comentarios/${meu}`, outro).expect(403);
      await com('delete', `/api/comentarios/${meu}`, torcedor).expect(204);
      await com('delete', `/api/comentarios/${meu}`, torcedor).expect(404);
      const dele = (await com('post', `/api/posts/${postId}/comentarios`, outro).send({ texto: 'do outro' }).expect(201)).body.id;
      await com('delete', `/api/comentarios/${dele}`, admin).expect(204);
      await com('delete', '/api/comentarios/nao-e-uuid', admin).expect(404);
    });

    it('post inexistente → 404', async () => {
      await com('get', '/api/posts/00000000-0000-4000-8000-000000000000/comentarios', torcedor).expect(404);
      await com('post', '/api/posts/00000000-0000-4000-8000-000000000000/comentarios', torcedor).send({ texto: 'oi' }).expect(404);
    });
  });
});
