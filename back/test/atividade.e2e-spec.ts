import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { vi } from 'vitest';
import { CleanupService } from '../src/auth/cleanup.service.js';
import type { PrismaService } from '../src/prisma.service.js';
import { PushService } from '../src/push/push.service.js';
import { apagarClubesDeTeste, cadastrarUsuario, criarApp, criarClubesDeTeste, ORIGIN } from './helpers.js';

// Clubes teste-atividade-N são só deste arquivo (os e2e rodam em paralelo no mesmo banco).
type U = { id: string; email: string; cookie: string[] };
type Item = { id: string; tipo: string; lida: boolean; ator: { id: string; nome: string } | null; post: { id: string; miniUrl: string | null; resumo: string } | null; votacao: { id: string; titulo: string } | null };

describe('atividade e menções (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let post: Awaited<ReturnType<typeof criarApp>>['post'];
  let http: () => ReturnType<INestApplication['getHttpServer']>;
  let c: string[];
  let tecnico0: U, tecnico1: U, torcedor: U, outro: U, admin: U;
  const usuarios: string[] = [];
  const esperar = () => new Promise((r) => setTimeout(r, 300)); // os ouvintes de evento rodam soltos
  const com = (m: 'get' | 'put' | 'post' | 'patch' | 'delete', url: string, u: U) => request(http())[m](url).set('Origin', ORIGIN).set('Cookie', u.cookie);
  const itens = async (u: U) => (await com('get', '/api/atividade', u).expect(200)).body.itens as Item[];
  const tipos = async (u: U) => (await itens(u)).map((i) => i.tipo);
  const marca = (u: U, nome: string) => `@[${nome}](${u.id})`;
  const postar = async (u: U, texto: string) => (await com('post', '/api/posts', u).send({ texto }).expect(201)).body as { id: string; mencoes: { id: string; nome: string }[] };
  const comentar = (u: U, postId: string, texto: string) => com('post', `/api/posts/${postId}/comentarios`, u).send({ texto });

  beforeAll(async () => {
    ({ app, prisma, post, http } = await criarApp());
    c = await criarClubesDeTeste(prisma, 'atividade', 3);
    tecnico0 = await cadastrarUsuario(post, prisma, c[0], 'Técnico Zero');
    tecnico1 = await cadastrarUsuario(post, prisma, c[1], 'Técnico Um');
    torcedor = await cadastrarUsuario(post, prisma, null, 'Torcedor Atividade');
    outro = await cadastrarUsuario(post, prisma, null, 'Outro Mencionado');
    admin = await cadastrarUsuario(post, prisma, null, 'Admin Atividade');
    usuarios.push(tecnico0.id, tecnico1.id, torcedor.id, outro.id, admin.id);
    await prisma.user.update({ where: { id: admin.id }, data: { isAdmin: true } });
  });
  afterEach(async () => {
    vi.restoreAllMocks();
    await prisma.notificacao.deleteMany({ where: { userId: { in: usuarios } } });
    await prisma.votacao.deleteMany({ where: { criadaPor: admin.id } });
    await prisma.post.deleteMany({ where: { authorId: { in: usuarios } } });
  });
  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: usuarios } } });
    await apagarClubesDeTeste(prisma, c);
    await app.close();
  });

  it('reagir no post do clube cria 1 REACAO para o técnico atual (trocar a reação não duplica)', async () => {
    const p = await postar(tecnico0, 'Post do zero');
    await com('put', `/api/posts/${p.id}/reacao`, torcedor).send({ emoji: '❤️' }).expect(204);
    await esperar();
    expect(await itens(tecnico0)).toMatchObject([{ tipo: 'REACAO', lida: false, ator: { id: torcedor.id }, post: { id: p.id, resumo: 'Post do zero' } }]);
    await com('post', '/api/atividade/lidas', tecnico0).expect(204);
    await com('put', `/api/posts/${p.id}/reacao`, torcedor).send({ emoji: '🔥' }).expect(204);
    await esperar();
    const depois = await itens(tecnico0);
    expect(depois).toHaveLength(1);
    expect(depois[0].lida).toBe(false); // a reação nova volta a aparecer como não lida
    await com('put', `/api/posts/${p.id}/reacao`, outro).send({ emoji: '👏' }).expect(204);
    await esperar();
    expect(await itens(tecnico0)).toHaveLength(2); // pessoa diferente = outro item
  });

  it('comentar cria COMENTARIO para o técnico do clube do post', async () => {
    const p = await postar(tecnico0, 'Post para comentar');
    await comentar(torcedor, p.id, 'Boa!').expect(201);
    await esperar();
    expect(await itens(tecnico0)).toMatchObject([{ tipo: 'COMENTARIO', ator: { id: torcedor.id }, post: { id: p.id } }]);
    expect(await itens(torcedor)).toEqual([]);
  });

  it('mencionar no comentário cria MENCAO + push só para o mencionado', async () => {
    const espia = vi.spyOn(app.get(PushService), 'enviar').mockResolvedValue();
    const p = await postar(tecnico0, 'Post com menção');
    await esperar();
    espia.mockClear();
    await comentar(torcedor, p.id, `E aí ${marca(outro, 'Outro Mencionado')}?`).expect(201);
    await esperar();
    expect(await itens(outro)).toMatchObject([{ tipo: 'MENCAO', ator: { id: torcedor.id }, post: { id: p.id } }]);
    const mencao = espia.mock.calls.filter(([, m]) => m.titulo === 'Menção');
    expect(mencao).toEqual([[[outro.id], { titulo: 'Menção', corpo: 'Torcedor Atividade mencionou você', url: `/p/${p.id}` }]]);
    // o técnico recebe o aviso de comentário de sempre, não um push de menção
    expect(await tipos(tecnico0)).toEqual(['COMENTARIO']);
  });

  it('editar a legenda mantendo a menção não repete; menção nova avisa só a nova', async () => {
    const p = await postar(tecnico0, `Salve ${marca(outro, 'Outro Mencionado')}`);
    await esperar();
    expect(await tipos(outro)).toEqual(['MENCAO']);
    await com('patch', `/api/posts/${p.id}`, tecnico0).send({ texto: `Salve de novo ${marca(outro, 'Outro Mencionado')}` }).expect(200);
    await esperar();
    expect(await tipos(outro)).toEqual(['MENCAO']);
    await com('patch', `/api/posts/${p.id}`, tecnico0).send({ texto: `Salve ${marca(outro, 'Outro Mencionado')} e ${marca(tecnico1, 'Técnico Um')}` }).expect(200);
    await esperar();
    expect(await tipos(outro)).toEqual(['MENCAO']);
    expect(await tipos(tecnico1)).toEqual(['MENCAO']);
  });

  it('menção a uuid inexistente é ignorada; o nome mostrado vem do banco, não do texto', async () => {
    const p = await postar(tecnico0, `Oi @[Fabio](00000000-0000-4000-8000-000000000000) e @[Fulano Falso](${outro.id}) e @[x](${outro.id})`);
    await esperar();
    expect(p.mencoes).toEqual([{ id: outro.id, nome: 'Outro Mencionado' }]);
    expect(await tipos(outro)).toEqual(['MENCAO']); // uma vez só, mesmo citado duas vezes no texto
    const lido = (await com('get', `/api/posts/${p.id}`, torcedor).expect(200)).body;
    expect(lido.mencoes).toEqual([{ id: outro.id, nome: 'Outro Mencionado' }]);
    const cm = (await comentar(torcedor, p.id, `@[Qualquer](${tecnico1.id})`).expect(201)).body;
    expect(cm.mencoes).toEqual([{ id: tecnico1.id, nome: 'Técnico Um' }]);
    const lista = (await com('get', `/api/posts/${p.id}/comentarios`, torcedor).expect(200)).body;
    expect(lista[0].mencoes).toEqual([{ id: tecnico1.id, nome: 'Técnico Um' }]);
  });

  it('mais de 10 menções: só as 10 primeiras valem', async () => {
    const p = await postar(tecnico0, 'Post');
    const falsas = Array.from({ length: 10 }, (_, i) => `@[x](00000000-0000-4000-8000-${String(i).padStart(12, '0')})`).join(' ');
    const cm = (await comentar(torcedor, p.id, `${falsas} ${marca(outro, 'Outro Mencionado')}`).expect(201)).body;
    await esperar();
    expect(cm.mencoes).toEqual([]); // as 10 primeiras não existem; a 11ª passou do limite
    expect(await tipos(outro)).toEqual([]);
  });

  it('ninguém é notificado da própria ação', async () => {
    const p = await postar(tecnico0, `Eu mesmo ${marca(tecnico0, 'Técnico Zero')}`);
    await com('put', `/api/posts/${p.id}/reacao`, tecnico0).send({ emoji: '🔥' }).expect(204);
    await comentar(tecnico0, p.id, `${marca(tecnico0, 'Técnico Zero')} comentando`).expect(201);
    await esperar();
    expect(await itens(tecnico0)).toEqual([]);
  });

  it('nao-lidas conta e lidas zera; só os meus itens', async () => {
    const p = await postar(tecnico0, 'Contagem');
    await comentar(torcedor, p.id, 'um').expect(201);
    await comentar(outro, p.id, 'dois').expect(201);
    await esperar();
    expect((await com('get', '/api/atividade/nao-lidas', tecnico0).expect(200)).body).toEqual({ total: 2 });
    expect((await com('get', '/api/atividade/nao-lidas', torcedor).expect(200)).body).toEqual({ total: 0 });
    await com('post', '/api/atividade/lidas', torcedor).expect(204);
    expect((await com('get', '/api/atividade/nao-lidas', tecnico0).expect(200)).body).toEqual({ total: 2 });
    await com('post', '/api/atividade/lidas', tecnico0).expect(204);
    expect((await com('get', '/api/atividade/nao-lidas', tecnico0).expect(200)).body).toEqual({ total: 0 });
    expect((await itens(tecnico0)).every((i) => i.lida)).toBe(true);
  });

  it('paginação por cursor: 20 por página, sem repetir', async () => {
    const p = await postar(tecnico0, 'Muito comentado');
    await prisma.notificacao.createMany({ data: Array.from({ length: 25 }, () => ({ userId: tecnico0.id, tipo: 'COMENTARIO' as const, atorId: torcedor.id, postId: p.id })) });
    const a = (await com('get', '/api/atividade', tecnico0).expect(200)).body;
    expect(a.itens).toHaveLength(20);
    const b = (await com('get', `/api/atividade?antes=${a.proximo}`, tecnico0).expect(200)).body;
    expect(b.itens).toHaveLength(5);
    expect(b.proximo).toBeNull();
    expect(new Set([...a.itens, ...b.itens].map((i: Item) => i.id)).size).toBe(25);
    await com('get', '/api/atividade?antes=lixo', tecnico0).expect(400);
  });

  it("post ocultado vira 'Post indisponível' (sem legenda nem foto); apagado some; o admin ainda vê", async () => {
    const p = await postar(tecnico0, 'Segredo da legenda');
    await comentar(torcedor, p.id, 'oi').expect(201);
    await esperar();
    await com('put', `/api/admin/posts/${p.id}/ocultar`, admin).expect(204);
    const item = (await itens(tecnico0))[0];
    expect(item.post).toEqual({ id: p.id, miniUrl: null, resumo: 'Post indisponível' });
    expect(JSON.stringify(await itens(tecnico0))).not.toContain('Segredo');
    expect((await itens(tecnico0)).length).toBe(1);
    await com('delete', `/api/admin/posts/${p.id}/ocultar`, admin).expect(204);
    expect((await itens(tecnico0))[0].post!.resumo).toBe('Segredo da legenda');
    await com('delete', `/api/posts/${p.id}`, tecnico0).expect(204);
    expect(await itens(tecnico0)).toEqual([]);
  });

  it('resumo do post tem no máximo 80 caracteres e mostra a menção como @Nome', async () => {
    const p = await postar(tecnico0, `${marca(outro, 'Outro Mencionado')} ${'x'.repeat(200)}`);
    await comentar(torcedor, p.id, 'oi').expect(201);
    await esperar();
    const r = (await itens(tecnico0))[0].post!.resumo;
    expect(r.length).toBeLessThanOrEqual(80);
    expect(r.startsWith('@Outro Mencionado x')).toBe(true);
  });

  it('o resumo usa o nome do banco, não o escrito na menção; id inexistente some', async () => {
    const p = await postar(tecnico0, `Fala @[Nome Forjado](${outro.id}) e @[Fantasma](00000000-0000-4000-8000-000000000000)!`);
    await comentar(torcedor, p.id, 'oi').expect(201);
    await esperar();
    const r = (await itens(tecnico0))[0].post!.resumo;
    expect(r).toBe('Fala @Outro Mencionado e !');
    expect(r).not.toMatch(/Forjado|Fantasma/);
  });

  it('decisão de troca cria TROCA_DECIDIDA para quem pediu; resultado de votação avisa todos menos o admin', async () => {
    const t = (await com('post', '/api/trocas', outro).send({ tipo: 'ASSUMIR', clubeId: c[2] }).expect(201)).body;
    await com('post', `/api/admin/trocas/${t.id}/recusar`, admin).expect(204);
    await esperar();
    expect(await itens(outro)).toMatchObject([{ tipo: 'TROCA_DECIDIDA', ator: null, post: null }]);
    const v = (await com('post', '/api/admin/votacoes', admin).send({ titulo: 'Melhor da rodada', tipo: 'CLUBE', opcoes: [c[0], c[1]], prazo: new Date(Date.now() + 86_400_000).toISOString() }).expect(201)).body;
    await com('post', `/api/votacoes/${v.id}/voto`, torcedor).send({ opcao: c[0] }).expect(204);
    await com('post', `/api/admin/votacoes/${v.id}/encerrar`, admin).expect(201);
    await esperar();
    expect(await itens(torcedor)).toMatchObject([{ tipo: 'VOTACAO_RESULTADO', votacao: { id: v.id, titulo: 'Melhor da rodada' } }]);
    expect(await tipos(admin)).toEqual([]);
    await prisma.coachTenure.deleteMany({ where: { userId: outro.id } });
  });

  it('limpeza apaga notificação com mais de 60 dias e mantém as recentes', async () => {
    const dia = 86_400_000;
    await prisma.notificacao.createMany({
      data: [
        { userId: tecnico0.id, tipo: 'TROCA_DECIDIDA', createdAt: new Date(Date.now() - 61 * dia) },
        { userId: tecnico0.id, tipo: 'TROCA_DECIDIDA', createdAt: new Date(Date.now() - 59 * dia) },
      ],
    });
    await app.get(CleanupService).limpar();
    expect(await prisma.notificacao.count({ where: { userId: tecnico0.id } })).toBe(1);
  });

  describe('GET /api/pessoas', () => {
    const buscar = async (q: string, u = torcedor) => (await com('get', `/api/pessoas?q=${encodeURIComponent(q)}`, u).expect(200)).body as { id: string; nome: string; avatarUrl: string | null; clube: { id: string; nome: string; escudoUrl: string } | null }[];

    it('acha por pedaço do nome, sem acento nem maiúsculas, com o clube; sem e-mail', async () => {
      const r = await buscar('tecnico');
      expect(r.map((x) => x.id)).toEqual(expect.arrayContaining([tecnico0.id, tecnico1.id]));
      expect(r.find((x) => x.id === tecnico0.id)).toEqual({ id: tecnico0.id, nome: 'Técnico Zero', avatarUrl: null, clube: { id: c[0], nome: 'Teste atividade 1', escudoUrl: '/escudos/generico.svg' } });
      expect((await buscar('OUTRO MENC')).map((x) => x.id)).toEqual([outro.id]);
      expect(JSON.stringify(r)).not.toContain('@');
      expect((await buscar('mencionado')).find((x) => x.id === outro.id)!.clube).toBeNull();
    });

    it('menos de 2 caracteres → lista vazia; % e _ valem como texto; no máximo 8', async () => {
      expect(await buscar('t')).toEqual([]);
      expect(await buscar('')).toEqual([]);
      expect(await buscar('%%')).toEqual([]);
      expect(await buscar('_x')).toEqual([]);
      expect(await buscar("'; drop table \"User\"; --")).toEqual([]);
      const extras = await Promise.all(Array.from({ length: 9 }, (_, i) => cadastrarUsuario(post, prisma, null, `Zzpessoa ${i}`)));
      usuarios.push(...extras.map((e) => e.id));
      expect(await buscar('zzpessoa')).toHaveLength(8);
    });

    it('exige sessão', async () => {
      await request(http()).get('/api/pessoas?q=tec').set('Origin', ORIGIN).expect(401);
      await request(http()).get('/api/atividade').set('Origin', ORIGIN).expect(401);
    });
  });
});
