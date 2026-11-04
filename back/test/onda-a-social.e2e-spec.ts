import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { PrismaService } from '../src/prisma.service.js';
import { apagarClubesDeTeste, cadastrarUsuario, criarApp, criarClubesDeTeste, ORIGIN } from './helpers.js';
import { montarJpeg } from './jpeg.js';

// Clubes próprios (teste-social-N): não disputa os clubes reais com os outros arquivos.
describe('onda A · hashtags, favoritos, bio/capa, denúncias e ocultar (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let post: Awaited<ReturnType<typeof criarApp>>['post'];
  let http: () => ReturnType<INestApplication['getHttpServer']>;
  type U = Awaited<ReturnType<typeof cadastrarUsuario>>;
  let c1: string, c2: string;
  let tecnico: U, tecnico2: U, torcedor: U, outro: U, admin: U;
  const ids: string[] = [];
  const com = (m: 'get' | 'put' | 'post' | 'patch' | 'delete', url: string, u: U) => request(http())[m](url).set('Origin', ORIGIN).set('Cookie', u.cookie);
  const novoPost = async (extra: object = {}, clubId = c1, authorId = tecnico.id) => (await prisma.post.create({ data: { clubId, authorId, caption: 'p', ...extra } })).id;
  const novoComPrompt = async (clubId = c1, authorId = tecnico.id) => {
    const p = await prisma.post.create({
      data: { clubId, authorId, caption: 'img', images: { create: [{ position: 0, fullPath: '/uploads/x.jpg', thumbPath: '/uploads/y.jpg', width: 10, height: 10, prompt: 'um prompt' }] } },
      include: { images: true },
    });
    return { postId: p.id, imagemId: p.images[0].id };
  };
  const idsDe = (itens: { id: string }[]) => itens.map((i) => i.id);

  beforeAll(async () => {
    ({ app, prisma, post, http } = await criarApp());
    [c1, c2] = await criarClubesDeTeste(prisma, 'social', 2);
    tecnico = await cadastrarUsuario(post, prisma, c1, 'Técnico');
    tecnico2 = await cadastrarUsuario(post, prisma, c2, 'Técnico 2');
    [torcedor, outro, admin] = [await cadastrarUsuario(post, prisma, null, 'Torcedor'), await cadastrarUsuario(post, prisma, null, 'Outro'), await cadastrarUsuario(post, prisma, null, 'Admin')];
    ids.push(tecnico.id, tecnico2.id, torcedor.id, outro.id, admin.id);
    await prisma.user.update({ where: { id: admin.id }, data: { isAdmin: true } });
  });
  afterEach(() => prisma.post.deleteMany({ where: { clubId: { in: [c1, c2] } } }));
  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await apagarClubesDeTeste(prisma, [c1, c2]);
    await app.close();
  });

  describe('hashtags', () => {
    it('?tag=contratacao acha post com #Contratação (legenda ou texto), sem acento e só palavra inteira', async () => {
      const a = await novoPost({ caption: 'Reforço #Contratação confirmada' });
      const b = await novoPost({ caption: '', texto: 'olha a #contratacao!' });
      const nao1 = await novoPost({ caption: 'site.com/#contratacao' });
      const nao2 = await novoPost({ caption: '#contratacoes demais' });
      const nao3 = await novoPost({ caption: 'sem tag' });
      const res = (await com('get', '/api/posts?tag=contratacao', torcedor).expect(200)).body;
      expect(idsDe(res.itens)).toEqual(expect.arrayContaining([a, b]));
      for (const n of [nao1, nao2, nao3]) expect(idsDe(res.itens)).not.toContain(n);
      expect((await com('get', '/api/posts?tag=Contratação', torcedor).expect(200)).body.itens).toHaveLength(2);
      expect(res.fixados).toBeUndefined();
    });

    it('?tag= pagina com cursor (12 por página)', async () => {
      for (let i = 0; i < 13; i++) await novoPost({ caption: `#paginacao ${i}`, createdAt: new Date(Date.now() - i * 1000) });
      const p1 = (await com('get', '/api/posts?tag=paginacao', torcedor).expect(200)).body;
      expect(p1.itens).toHaveLength(12);
      const p2 = (await com('get', `/api/posts?tag=paginacao&antes=${p1.proximo}`, torcedor).expect(200)).body;
      expect(p2.itens).toHaveLength(1);
      expect(p2.proximo).toBeNull();
    });

    it('tag vazia ou só símbolos → lista vazia (não 500)', async () => {
      for (const t of ['', '%23', '!!!']) expect((await com('get', `/api/posts?tag=${t}`, torcedor).expect(200)).body.itens).toEqual([]);
    });
  });

  describe('favoritos da galeria', () => {
    it('favoritar duas vezes conta 1 e ?favoritos=1 só traz os meus', async () => {
      const a = await novoComPrompt();
      const b = await novoComPrompt();
      await com('put', `/api/galeria/${a.imagemId}/favorito`, torcedor).expect(204);
      await com('put', `/api/galeria/${a.imagemId}/favorito`, torcedor).expect(204);
      expect(await prisma.promptFavorite.count({ where: { imageId: a.imagemId } })).toBe(1);
      const minha = (await com('get', `/api/galeria?clube=${c1}&favoritos=1`, torcedor).expect(200)).body.itens;
      expect(minha.map((i: { imagemId: string }) => i.imagemId)).toEqual([a.imagemId]);
      expect((await com('get', `/api/galeria?clube=${c1}&favoritos=1`, outro).expect(200)).body.itens).toEqual([]);
      const todas = (await com('get', `/api/galeria?clube=${c1}`, torcedor).expect(200)).body.itens;
      expect(Object.fromEntries(todas.map((i: { imagemId: string; favorito: boolean }) => [i.imagemId, i.favorito]))).toEqual({ [a.imagemId]: true, [b.imagemId]: false });
      await com('delete', `/api/galeria/${a.imagemId}/favorito`, torcedor).expect(204);
      await com('delete', `/api/galeria/${a.imagemId}/favorito`, torcedor).expect(204);
      expect((await com('get', `/api/galeria?clube=${c1}&favoritos=1`, torcedor).expect(200)).body.itens).toEqual([]);
    });

    it('imagem inexistente → 404', async () => {
      await com('put', '/api/galeria/00000000-0000-4000-8000-000000000000/favorito', torcedor).expect(404);
    });
  });

  describe('bio e capa do clube', () => {
    it('técnico edita bio (300 ok, 301 → 400); GET traz bio e capaUrl', async () => {
      await com('patch', `/api/clubes/${c1}`, tecnico).send({ bio: 'x'.repeat(300) }).expect(200);
      await com('patch', `/api/clubes/${c1}`, tecnico).send({ bio: 'x'.repeat(301) }).expect(400);
      await com('patch', `/api/clubes/${c1}`, tecnico).send({ bio: 'Time do coração' }).expect(200);
      expect((await com('get', `/api/clubes/${c1}`, torcedor).expect(200)).body).toMatchObject({ bio: 'Time do coração', capaUrl: null });
    });

    it('torcedor e técnico de outro clube → 403; admin pode', async () => {
      await com('patch', `/api/clubes/${c1}`, torcedor).send({ bio: 'x' }).expect(403);
      await com('patch', `/api/clubes/${c1}`, tecnico2).send({ bio: 'x' }).expect(403);
      await com('patch', `/api/clubes/${c1}`, admin).send({ bio: 'do admin' }).expect(200);
      await com('patch', `/api/clubes/nao-existe`, admin).send({ bio: 'x' }).expect(404);
    });

    it('ex-técnico PATCH bio → 403', async () => {
      await com('post', `/api/admin/clubes/${c2}/remover-tecnico`, admin).expect(204);
      await com('patch', `/api/clubes/${c2}`, tecnico2).send({ bio: 'x' }).expect(403);
      await prisma.club.update({ where: { id: c2 }, data: { coachId: tecnico2.id } });
    });

    it('capa PNG → 400 IMAGEM_INVALIDA; JPEG ok, troca apaga a antiga; sem permissão → 403; > 3 MB → 413', async () => {
      const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      expect((await com('put', `/api/clubes/${c1}/capa`, tecnico).attach('capa', png, 'c.jpg').expect(400)).body.codigo).toBe('IMAGEM_INVALIDA');
      await com('put', `/api/clubes/${c1}/capa`, tecnico).expect(400);
      await com('put', `/api/clubes/${c1}/capa`, torcedor).attach('capa', montarJpeg(1500, 500), 'c.jpg').expect(403);
      const r1 = await com('put', `/api/clubes/${c1}/capa`, tecnico).attach('capa', montarJpeg(1500, 500), 'c.jpg').expect(200);
      expect(r1.body.capaUrl).toMatch(/^\/uploads\/capas\/[0-9a-f]{32}\.jpg$/);
      const r2 = await com('put', `/api/clubes/${c1}/capa`, tecnico).attach('capa', montarJpeg(1500, 500), 'c.jpg').expect(200);
      expect(r2.body.capaUrl).not.toBe(r1.body.capaUrl);
      const { stat } = await import('node:fs/promises');
      const naDisco = (u: string) => stat(`${process.env.UPLOADS_DIR ?? './uploads'}/${u.replace('/uploads/', '')}`).then(() => true, () => false);
      expect(await naDisco(r1.body.capaUrl)).toBe(false);
      expect(await naDisco(r2.body.capaUrl)).toBe(true);
      await com('put', `/api/clubes/${c1}/capa`, tecnico).attach('capa', Buffer.concat([montarJpeg(10, 10), Buffer.alloc(3 * 1024 * 1024)]), 'c.jpg').expect(413);
    });
  });

  describe('ocultar (admin) e ocultar para mim', () => {
    it('post ocultado some do feed/galeria/clube/tag e /p/:id → 404 para não-admin; admin vê oculto:true', async () => {
      const { postId } = await novoComPrompt();
      await prisma.post.update({ where: { id: postId }, data: { caption: '#sumiu' } });
      await com('put', `/api/admin/posts/${postId}/ocultar`, admin).expect(204);
      await com('put', `/api/admin/posts/${postId}/ocultar`, tecnico).expect(403);
      for (const url of ['/api/posts', `/api/posts?clube=${c1}`, '/api/posts?tag=sumiu', `/api/galeria?clube=${c1}`]) {
        const itens = (await com('get', url, torcedor).expect(200)).body.itens;
        expect(JSON.stringify(itens)).not.toContain(postId);
      }
      await com('get', `/api/posts/${postId}`, torcedor).expect(404);
      await com('get', `/api/posts/${postId}`, tecnico).expect(404);
      await com('put', `/api/posts/${postId}/reacao`, torcedor).send({ emoji: '🔥' }).expect(404);
      expect((await com('get', `/api/posts/${postId}`, admin).expect(200)).body.oculto).toBe(true);
      expect(idsDe((await com('get', `/api/posts?clube=${c1}`, admin).expect(200)).body.itens)).toContain(postId);
      expect(idsDe((await com('get', '/api/posts?tag=sumiu', admin).expect(200)).body.itens)).toContain(postId);
      await com('delete', `/api/admin/posts/${postId}/ocultar`, admin).expect(204);
      expect((await com('get', `/api/posts/${postId}`, torcedor).expect(200)).body.oculto).toBe(false);
    });

    it('ocultar desafixa e libera a vaga; mostrar de novo não volta fixado e o limite segue em 3', async () => {
      const [a, b, c, d] = [await novoPost(), await novoPost(), await novoPost(), await novoPost()];
      for (const id of [a, b, c]) await com('put', `/api/admin/posts/${id}/fixar`, admin).expect(204);
      await com('put', `/api/admin/posts/${a}/ocultar`, admin).expect(204);
      expect(idsDe((await com('get', '/api/posts', torcedor).expect(200)).body.fixados)).not.toContain(a);
      await com('put', `/api/admin/posts/${d}/fixar`, admin).expect(204); // vaga liberada pelo ocultar
      await com('delete', `/api/admin/posts/${a}/ocultar`, admin).expect(204);
      expect((await com('get', `/api/posts/${a}`, admin).expect(200)).body.fixado).toBe(false);
      const fixados = idsDe((await com('get', '/api/posts', torcedor).expect(200)).body.fixados);
      expect(fixados).toHaveLength(3);
      expect(fixados).not.toContain(a);
      expect((await com('put', `/api/admin/posts/${a}/fixar`, admin).expect(409)).body.codigo).toBe('LIMITE_FIXADOS');
      for (const id of [b, c, d]) await com('delete', `/api/admin/posts/${id}/fixar`, admin).expect(204);
    });

    it('ocultar-para-mim some só para mim (e desfaz)', async () => {
      const id = await novoPost({ caption: 'meu' });
      await com('put', `/api/posts/${id}/ocultar-para-mim`, torcedor).expect(204);
      await com('put', `/api/posts/${id}/ocultar-para-mim`, torcedor).expect(204);
      expect(idsDe((await com('get', `/api/posts?clube=${c1}`, torcedor).expect(200)).body.itens)).not.toContain(id);
      expect(idsDe((await com('get', `/api/posts?clube=${c1}`, outro).expect(200)).body.itens)).toContain(id);
      await com('delete', `/api/posts/${id}/ocultar-para-mim`, torcedor).expect(204);
      await com('delete', `/api/posts/${id}/ocultar-para-mim`, torcedor).expect(204);
      expect(idsDe((await com('get', `/api/posts?clube=${c1}`, torcedor).expect(200)).body.itens)).toContain(id);
      await com('put', '/api/posts/00000000-0000-4000-8000-000000000000/ocultar-para-mim', torcedor).expect(404);
    });

    it('comentário ocultado some da lista e da contagem para não-admin; admin vê oculto:true', async () => {
      const id = await novoPost();
      const c = (await com('post', `/api/posts/${id}/comentarios`, torcedor).send({ texto: 'ofensivo' }).expect(201)).body;
      await com('post', `/api/posts/${id}/comentarios`, outro).send({ texto: 'normal' }).expect(201);
      await com('put', `/api/admin/comentarios/${c.id}/ocultar`, torcedor).expect(403);
      await com('put', `/api/admin/comentarios/${c.id}/ocultar`, admin).expect(204);
      const visto = (await com('get', `/api/posts/${id}/comentarios`, outro).expect(200)).body;
      expect(visto.map((x: { texto: string }) => x.texto)).toEqual(['normal']);
      expect((await com('get', `/api/posts/${id}`, outro).expect(200)).body.comentarios).toBe(1);
      const adm = (await com('get', `/api/posts/${id}/comentarios`, admin).expect(200)).body;
      expect(adm.map((x: { oculto: boolean }) => x.oculto)).toEqual([true, false]);
      expect((await com('get', `/api/posts/${id}`, admin).expect(200)).body.comentarios).toBe(2);
      await com('delete', `/api/admin/comentarios/${c.id}/ocultar`, admin).expect(204);
      expect((await com('get', `/api/posts/${id}/comentarios`, outro).expect(200)).body).toHaveLength(2);
    });
  });

  describe('editar texto do post de texto', () => {
    const editar = (id: string, u: U, corpo: object) => com('patch', `/api/posts/${id}`, u).send(corpo);

    it('técnico e admin editam o texto (trim); legenda/prompts continuam como antes', async () => {
      const id = await novoPost({ caption: '', texto: 'antes' });
      expect((await editar(id, tecnico, { texto: '  depois  ' }).expect(200)).body).toMatchObject({ id, texto: 'depois', imagens: [] });
      expect((await editar(id, admin, { texto: 'x'.repeat(500) }).expect(200)).body.texto).toHaveLength(500);
      expect((await com('get', `/api/posts/${id}`, torcedor).expect(200)).body.texto).toHaveLength(500);
    });

    it('vazio, só espaços, 501 ou tipo errado → 400 DADOS_INVALIDOS; post não muda', async () => {
      const id = await novoPost({ caption: '', texto: 'fica' });
      for (const texto of ['', '   ', 'x'.repeat(501), 7, null])
        expect((await editar(id, tecnico, { texto }).expect(400)).body.codigo).toBe('DADOS_INVALIDOS');
      expect((await com('get', `/api/posts/${id}`, torcedor).expect(200)).body.texto).toBe('fica');
    });

    it('post com imagens → 400; sem permissão → 403; inexistente → 404', async () => {
      const { postId } = await novoComPrompt();
      expect((await editar(postId, tecnico, { texto: 'oi' }).expect(400)).body.codigo).toBe('DADOS_INVALIDOS');
      const id = await novoPost({ caption: '', texto: 'meu' });
      await editar(id, torcedor, { texto: 'invadi' }).expect(403);
      await editar(id, tecnico2, { texto: 'invadi' }).expect(403);
      await editar('00000000-0000-4000-8000-000000000000', tecnico, { texto: 'x' }).expect(404);
    });
  });

  describe('denúncias', () => {
    it('denúncia aparece em /admin/denuncias e some ao resolver (?abertas=1)', async () => {
      const id = await novoPost({ caption: 'denunciado' });
      const r = await com('post', '/api/denuncias', torcedor).send({ postId: id, motivo: 'spam' }).expect(201);
      const abertas = (await com('get', '/api/admin/denuncias?abertas=1', admin).expect(200)).body.itens;
      const d = abertas.find((x: { id: string }) => x.id === r.body.id);
      expect(d).toMatchObject({ motivo: 'spam', resolvidaEm: null, denunciante: { id: torcedor.id }, post: { id } });
      await com('get', '/api/admin/denuncias', torcedor).expect(403);
      await com('post', `/api/admin/denuncias/${r.body.id}/resolver`, torcedor).expect(403);
      await com('post', `/api/admin/denuncias/${r.body.id}/resolver`, admin).expect(204);
      await com('post', `/api/admin/denuncias/${r.body.id}/resolver`, admin).expect(204);
      expect(idsDe((await com('get', '/api/admin/denuncias?abertas=1', admin).expect(200)).body.itens)).not.toContain(r.body.id);
      expect(idsDe((await com('get', '/api/admin/denuncias', admin).expect(200)).body.itens)).toContain(r.body.id);
      await com('post', '/api/admin/denuncias/00000000-0000-4000-8000-000000000000/resolver', admin).expect(404);
    });

    it('denúncia aberta repetida da mesma pessoa no mesmo post/comentário é ignorada (201, mesma linha); outra pessoa ou depois de resolver abre nova', async () => {
      const id = await novoPost();
      const c = (await com('post', `/api/posts/${id}/comentarios`, outro).send({ texto: 'x' }).expect(201)).body;
      const r1 = await com('post', '/api/denuncias', torcedor).send({ postId: id }).expect(201);
      const r2 = await com('post', '/api/denuncias', torcedor).send({ postId: id, motivo: 'de novo' }).expect(201);
      expect(r2.body.id).toBe(r1.body.id);
      const rc1 = await com('post', '/api/denuncias', torcedor).send({ commentId: c.id }).expect(201);
      expect((await com('post', '/api/denuncias', torcedor).send({ commentId: c.id }).expect(201)).body.id).toBe(rc1.body.id);
      expect(rc1.body.id).not.toBe(r1.body.id);
      expect((await com('post', '/api/denuncias', outro).send({ postId: id }).expect(201)).body.id).not.toBe(r1.body.id);
      expect(await prisma.report.count({ where: { postId: id } })).toBe(2);
      await com('post', `/api/admin/denuncias/${r1.body.id}/resolver`, admin).expect(204);
      expect((await com('post', '/api/denuncias', torcedor).send({ postId: id }).expect(201)).body.id).not.toBe(r1.body.id);
      expect(await prisma.report.count({ where: { postId: id } })).toBe(3);
    });

    it('GET /admin/denuncias pagina de 20 em 20 com cursor, sem repetir', async () => {
      const id = await novoPost();
      const criadas = [];
      for (let i = 0; i < 21; i++) criadas.push((await prisma.report.create({ data: { userId: torcedor.id, postId: id, createdAt: new Date(Date.now() - i * 1000) } })).id);
      const p1 = (await com('get', '/api/admin/denuncias?abertas=1', admin).expect(200)).body;
      expect(p1.itens).toHaveLength(20);
      expect(p1.proximo).toEqual(expect.any(String));
      const todas = [...p1.itens];
      for (let cursor = p1.proximo; cursor; ) {
        const p = (await com('get', `/api/admin/denuncias?abertas=1&antes=${cursor}`, admin).expect(200)).body;
        expect(p.itens.length).toBeLessThanOrEqual(20);
        todas.push(...p.itens);
        cursor = p.proximo;
      }
      const vistos = idsDe(todas);
      expect(new Set(vistos).size).toBe(vistos.length);
      expect(vistos).toEqual(expect.arrayContaining(criadas));
      await com('get', '/api/admin/denuncias?antes=lixo', admin).expect(400);
    });

    it('denunciar comentário; motivo opcional; validações', async () => {
      const id = await novoPost();
      const c = (await com('post', `/api/posts/${id}/comentarios`, outro).send({ texto: 'x' }).expect(201)).body;
      const r = await com('post', '/api/denuncias', torcedor).send({ commentId: c.id }).expect(201);
      const d = (await com('get', '/api/admin/denuncias?abertas=1', admin).expect(200)).body.itens.find((x: { id: string }) => x.id === r.body.id);
      expect(d).toMatchObject({ motivo: null, comentario: { id: c.id, texto: 'x', postId: id } });
      await com('post', '/api/denuncias', torcedor).send({}).expect(400);
      await com('post', '/api/denuncias', torcedor).send({ postId: id, commentId: c.id }).expect(400);
      await com('post', '/api/denuncias', torcedor).send({ postId: id, motivo: 'x'.repeat(301) }).expect(400);
      await com('post', '/api/denuncias', torcedor).send({ postId: '00000000-0000-4000-8000-000000000000' }).expect(404);
      await request(http()).post('/api/denuncias').set('Origin', ORIGIN).send({ postId: id }).expect(401);
    });
  });
});
