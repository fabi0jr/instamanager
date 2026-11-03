import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import webpush from 'web-push';
import type { PrismaService } from '../src/prisma.service.js';
import { cadastrarUsuario, criarApp, ORIGIN } from './helpers.js';
import { montarJpeg } from './jpeg.js';

vi.mock('web-push', () => ({ default: { setVapidDetails: vi.fn(), sendNotification: vi.fn() } }));

// Clubes só deste arquivo (os e2e rodam em paralelo): santos e red-bull-bragantino.
describe('push (e2e, web-push mockado)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let post: Awaited<ReturnType<typeof criarApp>>['post'];
  let http: () => ReturnType<INestApplication['getHttpServer']>;
  let dir: string;
  type U = Awaited<ReturnType<typeof cadastrarUsuario>> & { endpoint: string };
  let tecnico: U, ligado: U, desligado: U, admin: U;
  const enviar = vi.mocked(webpush.sendNotification);
  const ids: string[] = [];
  const com = (m: 'get' | 'post' | 'patch' | 'delete', url: string, u: { cookie: string[] }) => request(http())[m](url).set('Origin', ORIGIN).set('Cookie', u.cookie);

  const novo = async (clubeId: string | null, nome: string): Promise<U> => {
    const u = await cadastrarUsuario(post, prisma, clubeId, nome);
    ids.push(u.id);
    const endpoint = `https://push.exemplo.test/${randomUUID()}`;
    await com('post', '/api/push/inscricao', u).send({ endpoint, keys: { p256dh: 'chave-p256dh', auth: 'chave-auth' } }).expect(204);
    return { ...u, endpoint };
  };
  const meus = () => [tecnico, ligado, desligado, admin].map((u) => u.endpoint);
  /** Chamadas ao web-push para as inscrições deste arquivo: [endpoint, payload]. */
  const enviados = () =>
    enviar.mock.calls
      .filter(([s]) => meus().includes((s as { endpoint: string }).endpoint))
      .map(([s, p]) => [(s as { endpoint: string }).endpoint, JSON.parse(p as string)] as const);
  const para = (u: U) => enviados().filter(([e]) => e === u.endpoint).map(([, p]) => p);
  const postar = (legenda = 'Reforço novo') =>
    request(http()).post('/api/posts').set('Origin', ORIGIN).set('Cookie', tecnico.cookie).field('legenda', legenda).field('prompts', '[null]').attach('cheia', montarJpeg(1600, 1200), 'c.jpg').attach('mini', montarJpeg(480, 360), 'm.jpg');

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'im-push-'));
    vi.stubEnv('UPLOADS_DIR', dir);
    vi.stubEnv('VAPID_PUBLIC_KEY', 'chave-publica-de-teste');
    vi.stubEnv('VAPID_PRIVATE_KEY', 'chave-privada-de-teste');
    vi.stubEnv('VAPID_SUBJECT', 'mailto:teste@exemplo.test');
    ({ app, prisma, post, http } = await criarApp());
    // inscreve depois de criar o app: o POST /inscricao não depende do envio
    tecnico = await novo('santos', 'Treinador');
    ligado = await novo(null, 'Ligado');
    desligado = await novo(null, 'Desligado');
    admin = await novo(null, 'Admin');
    await prisma.user.update({ where: { id: admin.id }, data: { isAdmin: true } });
    await com('patch', '/api/me', desligado).send({ pushEnabled: false }).expect(200);
  });
  beforeEach(() => {
    enviar.mockReset();
    enviar.mockResolvedValue({ statusCode: 201, body: '', headers: {} });
  });
  afterAll(async () => {
    vi.unstubAllEnvs();
    await prisma.post.deleteMany({ where: { clubId: 'santos' } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } }); // apaga as inscrições junto
    await app.close();
    await rm(dir, { recursive: true, force: true });
  });

  describe('rotas', () => {
    it('GET /push/chave devolve a chave pública; sem sessão → 401', async () => {
      expect((await com('get', '/api/push/chave', ligado).expect(200)).body).toEqual({ chave: 'chave-publica-de-teste' });
      await request(http()).get('/api/push/chave').expect(401);
    });

    it('POST /inscricao é upsert por endpoint e valida o corpo (https, domínio, chaves)', async () => {
      const endpoint = `https://push.exemplo.test/${randomUUID()}`;
      const corpo = { endpoint, keys: { p256dh: 'a', auth: 'b' } };
      await com('post', '/api/push/inscricao', ligado).send(corpo).expect(204);
      await com('post', '/api/push/inscricao', ligado).send({ ...corpo, keys: { p256dh: 'c', auth: 'd' } }).expect(204);
      const linhas = await prisma.pushSubscription.findMany({ where: { endpoint } });
      expect(linhas).toHaveLength(1);
      expect(linhas[0]).toMatchObject({ userId: ligado.id, p256dh: 'c', auth: 'd' });
      // o aparelho trocou de dono: a inscrição passa para quem entrou agora
      await com('post', '/api/push/inscricao', admin).send(corpo).expect(204);
      expect((await prisma.pushSubscription.findUniqueOrThrow({ where: { endpoint } })).userId).toBe(admin.id);

      // o servidor chama esse endereço: nada de http, localhost, IP ou rede interna
      for (const ruim of ['http://push.exemplo.test/x', 'https://localhost/x', 'https://127.0.0.1/x', 'https://[::1]/x', 'https://servidor-interno/x', 'https://intranet.local/x', 'nao-e-url', '']) {
        await com('post', '/api/push/inscricao', ligado).send({ endpoint: ruim, keys: { p256dh: 'a', auth: 'b' } }).expect(400);
      }
      await com('post', '/api/push/inscricao', ligado).send({ endpoint, keys: { p256dh: 'a' } }).expect(400);
      await prisma.pushSubscription.deleteMany({ where: { endpoint } });
    });

    it('DELETE /inscricao apaga só a inscrição da própria pessoa', async () => {
      const endpoint = `https://push.exemplo.test/${randomUUID()}`;
      await com('post', '/api/push/inscricao', ligado).send({ endpoint, keys: { p256dh: 'a', auth: 'b' } }).expect(204);
      await com('delete', '/api/push/inscricao', desligado).send({ endpoint }).expect(204);
      expect(await prisma.pushSubscription.count({ where: { endpoint } })).toBe(1);
      await com('delete', '/api/push/inscricao', ligado).send({ endpoint }).expect(204);
      expect(await prisma.pushSubscription.count({ where: { endpoint } })).toBe(0);
    });
  });

  describe('post novo', () => {
    it('envia para todos com push ligado, menos o autor e quem desligou; mensagem exata', async () => {
      const res = await postar().expect(201);
      await vi.waitFor(() => expect(para(ligado)).toHaveLength(1));
      const esperado = { titulo: 'Santos', corpo: 'Treinador postou', url: `/p/${res.body.id}` };
      expect(para(ligado)).toEqual([esperado]);
      expect(para(admin)).toEqual([esperado]);
      expect(para(tecnico)).toEqual([]); // o autor não
      expect(para(desligado)).toEqual([]); // desligou no perfil
    });

    it('ligar/desligar pelo PATCH /me muda quem recebe', async () => {
      await com('patch', '/api/me', ligado).send({ pushEnabled: false }).expect(200);
      await com('patch', '/api/me', desligado).send({ pushEnabled: true }).expect(200);
      const res = await postar('de novo').expect(201);
      await vi.waitFor(() => expect(para(desligado)).toHaveLength(1));
      expect(para(desligado)[0].url).toBe(`/p/${res.body.id}`);
      expect(para(ligado)).toEqual([]);
      await com('patch', '/api/me', ligado).send({ pushEnabled: true }).expect(200);
      await com('patch', '/api/me', desligado).send({ pushEnabled: false }).expect(200);
    });

    it('o envio nunca atrasa a resposta do post (web-push pendurado)', async () => {
      enviar.mockImplementation(() => new Promise(() => undefined));
      const t0 = Date.now();
      await postar('rápido').expect(201);
      expect(Date.now() - t0).toBeLessThan(3000);
    });

    it('inscrição vencida (410) é apagada e as outras continuam recebendo (Review Focus 4)', async () => {
      const velha = `https://push.exemplo.test/${randomUUID()}`;
      await com('post', '/api/push/inscricao', ligado).send({ endpoint: velha, keys: { p256dh: 'a', auth: 'b' } }).expect(204);
      enviar.mockImplementation(async (s) => {
        if ((s as { endpoint: string }).endpoint === velha) throw Object.assign(new Error('Gone'), { statusCode: 410 });
        return { statusCode: 201, body: '', headers: {} };
      });
      await postar('com inscrição velha').expect(201);
      await vi.waitFor(async () => expect(await prisma.pushSubscription.count({ where: { endpoint: velha } })).toBe(0));
      await vi.waitFor(() => expect(para(ligado).length).toBeGreaterThanOrEqual(1));
      expect(await prisma.pushSubscription.count({ where: { endpoint: ligado.endpoint } })).toBe(1);
    });
  });

  describe('comentário', () => {
    let postId: string;
    beforeAll(async () => {
      postId = (await prisma.post.create({ data: { clubId: 'santos', authorId: tecnico.id, caption: 'x' } })).id;
    });

    it('comentário de outra pessoa avisa o técnico atual (texto cortado em 80); do próprio técnico não envia', async () => {
      const longo = 'a'.repeat(120);
      await com('post', `/api/posts/${postId}/comentarios`, ligado).send({ texto: longo }).expect(201);
      await vi.waitFor(() => expect(para(tecnico)).toHaveLength(1));
      expect(para(tecnico)[0]).toEqual({ titulo: 'Novo comentário', corpo: `Ligado: ${'a'.repeat(80)}`, url: `/p/${postId}` });
      expect(para(ligado)).toEqual([]);

      enviar.mockClear();
      await com('post', `/api/posts/${postId}/comentarios`, tecnico).send({ texto: 'eu mesmo' }).expect(201);
      await new Promise((r) => setTimeout(r, 300));
      expect(enviados()).toEqual([]);
    });

    it('técnico com push desligado não recebe', async () => {
      await com('patch', '/api/me', tecnico).send({ pushEnabled: false }).expect(200);
      await com('post', `/api/posts/${postId}/comentarios`, ligado).send({ texto: 'oi' }).expect(201);
      await new Promise((r) => setTimeout(r, 300));
      expect(para(tecnico)).toEqual([]);
      await com('patch', '/api/me', tecnico).send({ pushEnabled: true }).expect(200);
    });
  });

  describe('trocas', () => {
    it('pedido avisa os admins ("Pedido de troca" → /admin); decisão avisa quem pediu', async () => {
      const t = (await com('post', '/api/trocas', desligado).send({ tipo: 'ASSUMIR', clubeId: 'nao-existe' })).status;
      expect(t).toBe(404); // clube inexistente não gera pedido nem push
      await new Promise((r) => setTimeout(r, 200));
      expect(enviados()).toEqual([]);

      await com('patch', '/api/me', desligado).send({ pushEnabled: true }).expect(200);
      const pedido = (await com('post', '/api/trocas', desligado).send({ tipo: 'ASSUMIR', clubeId: 'red-bull-bragantino' }).expect(201)).body;
      await vi.waitFor(() => expect(para(admin)).toHaveLength(1));
      expect(para(admin)[0]).toMatchObject({ titulo: 'Pedido de troca', url: '/admin' });
      expect(para(ligado)).toEqual([]); // não-admin não recebe

      enviar.mockClear();
      await com('post', `/api/admin/trocas/${pedido.id}/recusar`, admin).expect(204);
      await vi.waitFor(() => expect(para(desligado)).toHaveLength(1));
      expect(para(desligado)[0]).toMatchObject({ titulo: 'Troca recusada', url: '/perfil' });
      expect(para(admin)).toEqual([]); // o admin não é avisado da própria decisão

      enviar.mockClear();
      const outro = (await com('post', '/api/trocas', desligado).send({ tipo: 'ASSUMIR', clubeId: 'red-bull-bragantino' }).expect(201)).body;
      await com('post', `/api/admin/trocas/${outro.id}/aprovar`, admin).expect(204);
      await vi.waitFor(() => expect(para(desligado).map((p: { titulo: string }) => p.titulo)).toContain('Troca aprovada'));
      await prisma.club.update({ where: { id: 'red-bull-bragantino' }, data: { coachId: null } });
    });
  });
});
