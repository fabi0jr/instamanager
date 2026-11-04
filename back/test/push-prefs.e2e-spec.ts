import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import webpush from 'web-push';
import { LembreteService } from '../src/bolao/lembrete.service.js';
import type { PrismaService } from '../src/prisma.service.js';
import { apagarClubesDeTeste, cadastrarUsuario, criarApp, criarClubesDeTeste, ORIGIN } from './helpers.js';
import { montarJpeg } from './jpeg.js';

vi.mock('web-push', () => ({ default: { setVapidDetails: vi.fn(), sendNotification: vi.fn() } }));

// Rodada 31 e clubes teste-pushprefs-N são só deste arquivo.
describe('preferências de push e lembrete do bolão (e2e, web-push mockado)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let http: () => ReturnType<INestApplication['getHttpServer']>;
  let dir: string;
  let c: string[];
  type U = Awaited<ReturnType<typeof cadastrarUsuario>> & { endpoint: string };
  let tecnico: U, padrao: U, semPosts: U, semBolao: U, completo: U;
  const enviar = vi.mocked(webpush.sendNotification);
  const ids: string[] = [];
  const com = (m: 'get' | 'post' | 'put' | 'patch', url: string, u: { cookie: string[] }) => request(http())[m](url).set('Origin', ORIGIN).set('Cookie', u.cookie);
  const novo = async (post: Awaited<ReturnType<typeof criarApp>>['post'], clubeId: string | null, nome: string): Promise<U> => {
    const u = await cadastrarUsuario(post, prisma, clubeId, nome);
    ids.push(u.id);
    const endpoint = `https://fcm.googleapis.com/fcm/send/${randomUUID()}`;
    await com('post', '/api/push/inscricao', u).send({ endpoint, keys: { p256dh: 'chave-p256dh', auth: 'chave-auth' } }).expect(204);
    return { ...u, endpoint };
  };
  /** Títulos recebidos por usuário (só inscrições deste arquivo). */
  const recebidos = (u: U) => enviar.mock.calls.filter(([s]) => (s as { endpoint: string }).endpoint === u.endpoint).map(([, p]) => JSON.parse(p as string).titulo as string);
  const esperar = (u: U, n: number) => vi.waitFor(() => expect(recebidos(u).length).toBeGreaterThanOrEqual(n));
  const postar = () => request(http()).post('/api/posts').set('Origin', ORIGIN).set('Cookie', tecnico.cookie).field('legenda', 'Reforço').field('prompts', '[null]').attach('cheia', montarJpeg(1600, 1200), 'c.jpg').attach('mini', montarJpeg(480, 360), 'm.jpg');

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'im-pushprefs-'));
    vi.stubEnv('UPLOADS_DIR', dir);
    vi.stubEnv('VAPID_PUBLIC_KEY', 'chave-publica-de-teste');
    vi.stubEnv('VAPID_PRIVATE_KEY', 'chave-privada-de-teste');
    vi.stubEnv('VAPID_SUBJECT', 'mailto:teste@exemplo.test');
    const a = await criarApp();
    ({ app, prisma, http } = a);
    c = await criarClubesDeTeste(prisma, 'pushprefs', 3);
    tecnico = await novo(a.post, c[0], 'Treinador');
    padrao = await novo(a.post, null, 'Padrão');
    semPosts = await novo(a.post, null, 'Sem posts');
    semBolao = await novo(a.post, null, 'Sem bolão');
    completo = await novo(a.post, null, 'Completo');
    await com('patch', '/api/me', semPosts).send({ pushPrefs: { posts: false } }).expect(200);
    await com('patch', '/api/me', semBolao).send({ pushPrefs: { bolao: false } }).expect(200);
    await prisma.rodada.update({ where: { numero: 31 }, data: { prazoPalpite: null } });
  });
  beforeEach(() => {
    enviar.mockReset();
    enviar.mockResolvedValue({ statusCode: 201, body: '', headers: {} });
  });
  afterEach(async () => {
    await prisma.palpite.deleteMany({ where: { userId: { in: ids } } });
    await prisma.jogo.deleteMany({ where: { rodadaNumero: 31 } });
    await prisma.lembreteEnviado.deleteMany({ where: { tipo: 'RODADA', refId: { startsWith: '31@' } } });
    await prisma.rodada.update({ where: { numero: 31 }, data: { prazoPalpite: null } });
  });
  afterAll(async () => {
    vi.unstubAllEnvs();
    await prisma.post.deleteMany({ where: { clubId: { in: c } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await apagarClubesDeTeste(prisma, c);
    await app.close();
    await rm(dir, { recursive: true, force: true });
  });

  describe('PATCH /me { pushPrefs }', () => {
    it('GET /me traz as 6 chaves, tudo true por padrão; PATCH liga/desliga uma e mantém as outras', async () => {
      const tudo = { posts: true, comentarios: true, mencoes: true, cbf: true, bolao: true, trocas: true };
      expect((await com('get', '/api/me', padrao).expect(200)).body.pushPrefs).toEqual(tudo);
      expect((await com('patch', '/api/me', padrao).send({ pushPrefs: { cbf: false } }).expect(200)).body.pushPrefs).toEqual({ ...tudo, cbf: false });
      expect((await com('patch', '/api/me', padrao).send({ pushPrefs: { trocas: false } }).expect(200)).body.pushPrefs).toEqual({ ...tudo, cbf: false, trocas: false });
      expect((await com('patch', '/api/me', padrao).send({ pushPrefs: { cbf: true, trocas: true } }).expect(200)).body.pushPrefs).toEqual(tudo);
      expect((await com('patch', '/api/me', padrao).send({ nome: 'Padrão' }).expect(200)).body.pushPrefs).toEqual(tudo); // outro PATCH não mexe
    });

    it('chave desconhecida, valor que não é booleano ou formato errado → 400', async () => {
      for (const ruim of [{ outra: true }, { posts: 'não' }, { posts: null }, [], 'x', null])
        await com('patch', '/api/me', padrao).send({ pushPrefs: ruim }).expect(400);
    });
  });

  describe('o push respeita a preferência', () => {
    it('post novo: quem desligou "posts" não recebe; quem não mexeu e quem desligou outro tipo recebem', async () => {
      await postar().expect(201);
      await esperar(padrao, 1);
      await esperar(semBolao, 1);
      expect(recebidos(semPosts)).toEqual([]);
    });

    it('comentário: o técnico que desligou "comentarios" não recebe', async () => {
      const p = (await postar().expect(201)).body;
      await com('patch', '/api/me', tecnico).send({ pushPrefs: { comentarios: false } }).expect(200);
      enviar.mockClear();
      await com('post', `/api/posts/${p.id}/comentarios`, padrao).send({ texto: 'bom' }).expect(201);
      await new Promise((r) => setTimeout(r, 300));
      expect(recebidos(tecnico)).toEqual([]);
      await com('patch', '/api/me', tecnico).send({ pushPrefs: { comentarios: true } }).expect(200);
      await com('post', `/api/posts/${p.id}/comentarios`, padrao).send({ texto: 'bom de novo' }).expect(201);
      await esperar(tecnico, 1);
    });
  });

  describe('lembrete do bolão', () => {
    const montar = async (prazo: Date | null) => {
      await prisma.jogo.createMany({ data: [{ rodadaNumero: 31, mandanteId: c[0], visitanteId: c[1] }] });
      await prisma.rodada.update({ where: { numero: 31 }, data: { prazoPalpite: prazo } });
      const [j] = await prisma.jogo.findMany({ where: { rodadaNumero: 31 } });
      await prisma.palpite.create({ data: { userId: completo.id, jogoId: j.id, golsMandante: 1, golsVisitante: 0 } });
    };
    const lembrete = () => app.get(LembreteService);
    const bolao = (u: U) => recebidos(u).filter((t) => t === 'Bolão');

    it('2 h antes: avisa quem falta palpitar, uma vez só; quem palpitou tudo e quem desligou "bolao" ficam de fora', async () => {
      await montar(new Date(Date.now() + 3_600_000));
      await lembrete().lembrar();
      await vi.waitFor(() => expect(bolao(padrao)).toHaveLength(1));
      expect(bolao(semPosts)).toHaveLength(1); // desligou outro tipo, não este
      expect(bolao(completo)).toEqual([]);
      expect(bolao(semBolao)).toEqual([]); // preferência desligada vale também para o lembrete
      await lembrete().lembrar();
      await lembrete().lembrar(new Date(Date.now() + 60_000));
      await new Promise((r) => setTimeout(r, 200));
      expect(bolao(padrao)).toHaveLength(1);
    });

    it('prazo a mais de 2 h, já vencido ou sem prazo: não avisa; se o prazo mudar para dentro da janela, avisa', async () => {
      await montar(new Date(Date.now() + 3 * 3_600_000));
      await lembrete().lembrar();
      await prisma.rodada.update({ where: { numero: 31 }, data: { prazoPalpite: new Date(Date.now() - 1000) } });
      await lembrete().lembrar();
      await prisma.rodada.update({ where: { numero: 31 }, data: { prazoPalpite: null } });
      await lembrete().lembrar();
      await new Promise((r) => setTimeout(r, 200));
      expect(bolao(padrao)).toEqual([]);
      await prisma.rodada.update({ where: { numero: 31 }, data: { prazoPalpite: new Date(Date.now() + 1_800_000) } });
      await lembrete().lembrar();
      await vi.waitFor(() => expect(bolao(padrao)).toHaveLength(1));
    });
  });
});
