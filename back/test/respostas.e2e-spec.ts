import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import webpush from 'web-push';
import type { PrismaService } from '../src/prisma.service.js';
import { apagarClubesDeTeste, cadastrarUsuario, criarApp, criarClubesDeTeste, ORIGIN } from './helpers.js';

vi.mock('web-push', () => ({ default: { setVapidDetails: vi.fn(), sendNotification: vi.fn() } }));

// Clube teste-respostas-1 é só deste arquivo.
describe('responder comentário (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let post: Awaited<ReturnType<typeof criarApp>>['post'];
  let http: () => ReturnType<INestApplication['getHttpServer']>;
  type U = Awaited<ReturnType<typeof cadastrarUsuario>> & { endpoint: string };
  let tecnico: U, ana: U, bruno: U, carla: U, admin: U;
  let c: string[];
  let postId: string;
  const ids: string[] = [];
  const enviar = vi.mocked(webpush.sendNotification);
  const com = (m: 'get' | 'put' | 'post' | 'patch' | 'delete', url: string, u: { cookie: string[] }) => request(http())[m](url).set('Origin', ORIGIN).set('Cookie', u.cookie);
  const novo = async (clubeId: string | null, nome: string): Promise<U> => {
    const u = await cadastrarUsuario(post, prisma, clubeId, nome);
    ids.push(u.id);
    const endpoint = `https://fcm.googleapis.com/fcm/send/${randomUUID()}`;
    await com('post', '/api/push/inscricao', u).send({ endpoint, keys: { p256dh: 'p', auth: 'a' } }).expect(204);
    return { ...u, endpoint };
  };
  const comentar = (u: U, texto: string, parentId?: unknown, no = postId) => com('post', `/api/posts/${no}/comentarios`, u).send({ texto, ...(parentId !== undefined && { parentId }) });
  const raiz = async (u: U, texto = 'raiz') => {
    const r = (await comentar(u, texto).expect(201)).body as { id: string; parentId: string | null };
    await esperar(); // o aviso do raiz sai solto: espera para não misturar com o da resposta
    return r;
  };
  const lista = async (u: U) => (await com('get', `/api/posts/${postId}/comentarios`, u).expect(200)).body as { id: string; texto: string; parentId: string | null }[];
  const esperar = () => new Promise((r) => setTimeout(r, 300)); // os ouvintes rodam soltos
  const tipos = async (u: U) => (await prisma.notificacao.findMany({ where: { userId: u.id }, orderBy: { createdAt: 'asc' } })).map((n) => n.tipo);
  const para = (u: U) => enviar.mock.calls.filter(([s]) => (s as { endpoint: string }).endpoint === u.endpoint).map(([, p]) => JSON.parse(p as string) as { titulo: string; corpo: string; url: string });

  beforeAll(async () => {
    vi.stubEnv('VAPID_PUBLIC_KEY', 'chave-publica-de-teste');
    vi.stubEnv('VAPID_PRIVATE_KEY', 'chave-privada-de-teste');
    vi.stubEnv('VAPID_SUBJECT', 'mailto:teste@exemplo.test');
    ({ app, prisma, post, http } = await criarApp());
    c = await criarClubesDeTeste(prisma, 'respostas', 1);
    tecnico = await novo(c[0], 'Técnico');
    ana = await novo(null, 'Ana');
    bruno = await novo(null, 'Bruno');
    carla = await novo(null, 'Carla');
    admin = await novo(null, 'Admin');
    await prisma.user.update({ where: { id: admin.id }, data: { isAdmin: true } });
    postId = (await prisma.post.create({ data: { clubId: c[0], authorId: tecnico.id, caption: 'p' } })).id;
  });
  beforeEach(() => enviar.mockReset());
  afterEach(async () => {
    await prisma.comment.deleteMany({ where: { postId: { in: await prisma.post.findMany({ where: { clubId: c[0] }, select: { id: true } }).then((p) => p.map((x) => x.id)) } } });
    await prisma.notificacao.deleteMany({ where: { userId: { in: ids } } });
  });
  afterAll(async () => {
    await prisma.post.deleteMany({ where: { clubId: c[0] } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await apagarClubesDeTeste(prisma, c);
    await app.close();
  });

  it('responde ao raiz; a lista continua plana, cronológica e cada item traz parentId (null no raiz)', async () => {
    const r = await raiz(ana);
    expect(r.parentId).toBeNull();
    const resp = (await comentar(bruno, 'resposta', r.id).expect(201)).body;
    expect(resp).toMatchObject({ texto: 'resposta', parentId: r.id });
    const outra = await raiz(carla, 'outro raiz');
    expect((await lista(ana)).map((x) => [x.id, x.parentId])).toEqual([[r.id, null], [resp.id, r.id], [outra.id, null]]);
  });

  it('responder uma resposta grava no mesmo parentId, o do raiz', async () => {
    const r = await raiz(ana);
    const r1 = (await comentar(bruno, 'resposta', r.id).expect(201)).body;
    const r2 = (await comentar(carla, 'resposta da resposta', r1.id).expect(201)).body;
    expect(r2.parentId).toBe(r.id);
    expect((await prisma.comment.findUnique({ where: { id: r2.id } }))!.parentId).toBe(r.id);
  });

  it('parentId inválido → 400 DADOS_INVALIDOS [parentId]: outro post, oculto, inexistente, malformado ou de outro tipo', async () => {
    const r = await raiz(ana);
    const outroPost = await prisma.post.create({ data: { clubId: c[0], authorId: tecnico.id, caption: 'outro' } });
    const noOutro = (await comentar(ana, 'lá', undefined, outroPost.id).expect(201)).body.id as string;
    const oculto = await raiz(ana, 'vai ocultar');
    await com('put', `/api/admin/comentarios/${oculto.id}/ocultar`, admin).expect(204);
    const respDoOculto = await prisma.comment.create({ data: { postId, userId: ana.id, text: 'filha do oculto', parentId: oculto.id } });

    for (const parentId of [noOutro, oculto.id, respDoOculto.id, randomUUID(), 'x', 123, ''] as unknown[]) {
      const res = await comentar(bruno, 'oi', parentId).expect(400);
      expect(res.body).toMatchObject({ codigo: 'DADOS_INVALIDOS', campos: ['parentId'] });
    }
    expect((await lista(bruno)).map((x) => x.id)).toEqual([r.id]); // nada foi gravado
    await comentar(bruno, 'ok', null).expect(201); // null = comentário normal
  });

  it('raiz oculto esconde as respostas (e a contagem) de quem não é admin; o admin vê tudo; mostrar de volta traz de volta', async () => {
    const r = await raiz(ana);
    await comentar(bruno, 'resposta', r.id).expect(201);
    await com('put', `/api/admin/comentarios/${r.id}/ocultar`, admin).expect(204);
    expect(await lista(carla)).toEqual([]);
    expect((await com('get', `/api/posts/${postId}`, carla).expect(200)).body.comentarios).toBe(0);
    expect(await lista(admin)).toHaveLength(2);
    expect((await com('get', `/api/posts/${postId}`, admin).expect(200)).body.comentarios).toBe(2);
    await com('delete', `/api/admin/comentarios/${r.id}/ocultar`, admin).expect(204);
    expect(await lista(carla)).toHaveLength(2);
  });

  it('apagar o raiz apaga as respostas', async () => {
    const r = await raiz(ana);
    await comentar(bruno, 'a', r.id).expect(201);
    await comentar(carla, 'b', r.id).expect(201);
    await com('delete', `/api/comentarios/${r.id}`, ana).expect(204);
    expect(await prisma.comment.count({ where: { postId } })).toBe(0);
  });

  it('avisa com RESPOSTA o autor do raiz e o da resposta respondida, sem o próprio; o técnico segue com COMENTARIO e push', async () => {
    const r = await raiz(ana, 'meu raiz');
    await prisma.notificacao.deleteMany({ where: { userId: { in: ids } } });
    enviar.mockReset();
    const r1 = (await comentar(bruno, 'respondi a Ana', r.id).expect(201)).body;
    await esperar();
    expect(await tipos(ana)).toEqual(['RESPOSTA']);
    expect(await tipos(tecnico)).toEqual(['COMENTARIO']); // dono do post, como hoje
    expect(await tipos(bruno)).toEqual([]);
    expect(para(ana)).toEqual([{ titulo: 'Nova resposta', corpo: 'Bruno: respondi a Ana', url: `/p/${postId}` }]);
    expect(para(tecnico)).toEqual([{ titulo: 'Novo comentário', corpo: 'Bruno: respondi a Ana', url: `/p/${postId}` }]);
    expect(para(bruno)).toEqual([]);

    await prisma.notificacao.deleteMany({ where: { userId: { in: ids } } });
    enviar.mockReset();
    await comentar(carla, 'respondi ao Bruno', r1.id).expect(201); // raiz da Ana, alvo do Bruno
    await esperar();
    expect(await tipos(ana)).toEqual(['RESPOSTA']);
    expect(await tipos(bruno)).toEqual(['RESPOSTA']);
    expect(await tipos(carla)).toEqual([]);
    expect(para(ana)).toHaveLength(1);
    expect(para(bruno)).toHaveLength(1);
    expect(para(carla)).toEqual([]);

    const item = ((await com('get', '/api/atividade', bruno).expect(200)).body.itens as { tipo: string; comentario: { resumo: string } | null; ator: { nome: string } }[])[0];
    expect(item).toMatchObject({ tipo: 'RESPOSTA', ator: { nome: 'Carla' }, comentario: { resumo: 'respondi ao Bruno' } });
  });

  it('quem é o autor do raiz e também o autor do alvo é avisado uma vez só', async () => {
    const r = await raiz(ana);
    await prisma.notificacao.deleteMany({ where: { userId: { in: ids } } });
    enviar.mockReset();
    await comentar(bruno, 'resposta direta', r.id).expect(201); // raiz = alvo = Ana
    await esperar();
    expect(await tipos(ana)).toEqual(['RESPOSTA']);
    expect(para(ana)).toHaveLength(1);
  });

  it('o técnico, dono do post, que também é autor do raiz, recebe só a RESPOSTA (sem COMENTARIO duplicado) e um push', async () => {
    const r = await raiz(tecnico, 'raiz do técnico');
    await prisma.notificacao.deleteMany({ where: { userId: { in: ids } } });
    enviar.mockReset();
    await comentar(bruno, 'respondi ao técnico', r.id).expect(201);
    await esperar();
    expect(await tipos(tecnico)).toEqual(['RESPOSTA']);
    expect(para(tecnico)).toEqual([{ titulo: 'Nova resposta', corpo: 'Bruno: respondi ao técnico', url: `/p/${postId}` }]);
  });

  it('a menção de quem foi respondido não vira um segundo aviso (MENCAO) além da RESPOSTA', async () => {
    const r = await raiz(ana);
    await prisma.notificacao.deleteMany({ where: { userId: { in: ids } } });
    await comentar(bruno, `@[Ana](${ana.id}) concordo`, r.id).expect(201);
    await esperar();
    expect(await tipos(ana)).toEqual(['RESPOSTA']);
  });

  it('comentário sem parentId segue como antes: COMENTARIO para o técnico, nada de RESPOSTA', async () => {
    await prisma.notificacao.deleteMany({ where: { userId: { in: ids } } });
    await raiz(ana);
    await esperar();
    expect(await tipos(tecnico)).toEqual(['COMENTARIO']);
    expect(await tipos(ana)).toEqual([]);
  });
});
