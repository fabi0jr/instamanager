import { request as httpRequest } from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { arquivosEm, gerarAmostras } from './amostras.js';
import { montarJpeg } from './jpeg.js';
import type { PrismaService } from '../src/prisma.service.js';
import {
  apagarClubesDeTeste,
  cadastrarUsuario,
  criarApp,
  criarClubesDeTeste,
  ORIGIN,
} from './helpers.js';

// Rodada 36, fase de copa de ordem 92 e clubes teste-mcp-N são só deste arquivo.
const CHAVE = 'chave-de-teste-mcp-0123456789abcdef';
type U = { id: string; cookie: string[] };
type Resp = {
  result?: {
    isError?: boolean;
    content: { text: string }[];
    tools?: { name: string }[];
  };
  error?: unknown;
};

describe('mcp: CBF via MCP (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let post: Awaited<ReturnType<typeof criarApp>>['post'];
  let http: () => ReturnType<INestApplication['getHttpServer']>;
  let c: string[];
  let admin: U, torcedor: U;
  let faseId: string;
  const usuarios: string[] = [];
  let ip = 0;
  const rpc = (
    corpo: object,
    chave: string | null = CHAVE,
    ipDe = `10.77.0.${++ip}`,
  ) => {
    const r = request(http())
      .post('/mcp')
      .set('Accept', 'application/json, text/event-stream')
      .set('X-Forwarded-For', ipDe);
    return (
      chave === null ? r : r.set('Authorization', `Bearer ${chave}`)
    ).send(corpo);
  };
  const chamar = async (name: string, args: object = {}) => {
    const r = await rpc({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: { name, arguments: args },
    }).expect(200);
    return r.body as Resp;
  };
  const texto = (r: Resp) => r.result!.content[0].text;
  const acoes = () =>
    prisma.mcpAcao.findMany({
      where: { createdAt: { gte: inicio } },
      orderBy: { createdAt: 'asc' },
    });
  const comAdmin = (url: string, u: U) =>
    request(http()).get(url).set('Origin', ORIGIN).set('Cookie', u.cookie);
  const jogo = (
    m: string,
    v: string,
    gm: number | null,
    gv: number | null,
  ) => ({ mandanteId: m, visitanteId: v, golsMandante: gm, golsVisitante: gv });
  const placares = (n: number) =>
    prisma.jogo.findMany({
      where: { rodadaNumero: n },
      orderBy: { id: 'asc' },
      select: { mandanteId: true, golsMandante: true, golsVisitante: true },
    });
  let inicio: Date;

  beforeAll(async () => {
    vi.stubEnv('MCP_CHAVE', CHAVE);
    ({ app, prisma, post, http } = await criarApp());
    c = await criarClubesDeTeste(prisma, 'mcp', 4);
    torcedor = await cadastrarUsuario(post, prisma, null, 'Torcedor Mcp');
    admin = await cadastrarUsuario(post, prisma, null, 'Admin Mcp');
    usuarios.push(torcedor.id, admin.id);
    await prisma.user.update({
      where: { id: admin.id },
      data: { isAdmin: true, createdAt: new Date(0) }, // o mais antigo: é o admin que o MCP usa, seja qual for o banco
    });
    faseId = (
      await request(http())
        .post('/api/admin/copa/fases')
        .set('Origin', ORIGIN)
        .set('Cookie', admin.cookie)
        .send({ nome: 'Fase MCP', ordem: 92 })
        .expect(201)
    ).body.id;
    inicio = new Date();
  });
  afterEach(async () => {
    await prisma.jogo.deleteMany({ where: { rodadaNumero: 36 } });
    await prisma.rodada.updateMany({
      where: { numero: 36 },
      data: { fechadaEm: null },
    });
  });
  afterAll(async () => {
    await prisma.mcpAcao.deleteMany({ where: { createdAt: { gte: inicio } } });
    await prisma.copaFase.deleteMany({ where: { id: faseId } });
    await new Promise((r) => setTimeout(r, 800)); // push/bot dos posts e stories e os anúncios de conquista saem depois da resposta
    await prisma.story.deleteMany({ where: { texto: { startsWith: 'mcp-' } } });
    await prisma.post.deleteMany({ where: { texto: { startsWith: 'mcp-' } } });
    // num banco sem admin anterior o admin do teste vira o autor dos anúncios de conquista: apaga esses posts antes dos usuários
    await prisma.post.deleteMany({ where: { authorId: { in: usuarios } } });
    await prisma.user.deleteMany({ where: { id: { in: usuarios } } });
    await apagarClubesDeTeste(prisma, c);
    await app.close();
  });

  describe('chave', () => {
    const ping = { jsonrpc: '2.0', id: 1, method: 'tools/list' };
    it('sem MCP_CHAVE → 404; vazia → 404', async () => {
      vi.stubEnv('MCP_CHAVE', '');
      await rpc(ping).expect(404);
      vi.stubEnv('MCP_CHAVE', CHAVE);
    });
    it('chave ausente, errada, vazia ou de outro tamanho → 401 com erro JSON-RPC (sem exceção)', async () => {
      for (const k of [
        null,
        'errada',
        '',
        CHAVE + 'x',
        CHAVE.slice(1),
        'x'.repeat(5000),
      ]) {
        const r = await rpc(ping, k).expect(401);
        expect(r.body).toMatchObject({
          jsonrpc: '2.0',
          error: { code: expect.any(Number), message: expect.any(String) },
          id: null,
        });
      }
    });
    it('GET e DELETE → 405; Origin não é exigido', async () => {
      await request(http())
        .get('/mcp')
        .set('Authorization', `Bearer ${CHAVE}`)
        .expect(405);
      await request(http())
        .delete('/mcp')
        .set('Authorization', `Bearer ${CHAVE}`)
        .expect(405);
      await rpc(ping).set('Origin', 'https://outro.site').expect(200);
    });
    it('chute repetido de um IP vira 429, mesmo com a chave certa depois', async () => {
      const mesmo = '10.78.0.1';
      for (let i = 0; i < 30; i++) await rpc(ping, 'errada', mesmo).expect(401);
      await rpc(ping, 'errada', mesmo).expect(429);
      await rpc(ping, CHAVE, mesmo).expect(429);
      await rpc(ping, CHAVE, '10.78.0.2').expect(200);
    });
  });

  it('initialize e tools/list trazem as 12 ferramentas', async () => {
    const init = await rpc({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-03-26',
        capabilities: {},
        clientInfo: { name: 't', version: '1' },
      },
    }).expect(200);
    expect(init.body.result.serverInfo).toBeDefined();
    const r = (
      await rpc({ jsonrpc: '2.0', id: 2, method: 'tools/list' }).expect(200)
    ).body as Resp;
    expect(r.result!.tools!.map((t) => t.name).sort()).toEqual(
      [
        'bolao_ranking',
        'calendario',
        'criar_post',
        'criar_story',
        'lancar_placares',
        'lancar_placares_copa',
        'postar_no_clube',
        'tabela',
        'ultimos_comentarios',
        'ultimos_posts',
      ].sort(),
    );
  });

  describe('escrita', () => {
    it('criar_post cria um post da CBF e uma McpAcao ok', async () => {
      const r = await chamar('criar_post', { texto: 'mcp-oi galera' });
      expect(r.result!.isError).toBeFalsy();
      expect(
        await prisma.post.count({
          where: { texto: 'mcp-oi galera', clubId: 'cbf' },
        }),
      ).toBe(1);
      expect(await acoes()).toMatchObject([
        {
          ferramenta: 'criar_post',
          ok: true,
          entrada: { texto: 'mcp-oi galera' },
        },
      ]);
    });
    it('criar_story cria story de texto da CBF; fundo inválido → isError', async () => {
      expect(
        (await chamar('criar_story', { texto: 'mcp-story', fundo: 'azul' }))
          .result!.isError,
      ).toBeFalsy();
      expect(
        await prisma.story.count({
          where: {
            texto: 'mcp-story',
            clubId: 'cbf',
            fundo: 'azul',
            tipo: 'TEXTO',
          },
        }),
      ).toBe(1);
      const ruim = await chamar('criar_story', {
        texto: 'mcp-x',
        fundo: 'rosa',
      });
      expect(ruim.result!.isError).toBe(true);
      expect(texto(ruim)).toMatch(/^DADOS_INVALIDOS: /);
    });
    describe('placares', () => {
      beforeEach(async () => {
        await request(http())
          .put('/api/admin/rodadas/36/jogos')
          .set('Origin', ORIGIN)
          .set('Cookie', admin.cookie)
          .send({
            jogos: [jogo(c[0], c[1], null, null), jogo(c[2], c[3], null, null)],
          })
          .expect(204);
      });
      it('lancar_placares troca só o jogo pedido', async () => {
        const r = await chamar('lancar_placares', {
          rodada: 36,
          placares: [
            {
              mandanteId: c[0],
              visitanteId: c[1],
              golsMandante: 3,
              golsVisitante: 1,
            },
          ],
        });
        expect(r.result!.isError).toBeFalsy();
        const p = await placares(36);
        expect(p.find((x) => x.mandanteId === c[0])).toMatchObject({
          golsMandante: 3,
          golsVisitante: 1,
        });
        expect(p.find((x) => x.mandanteId === c[2])).toMatchObject({
          golsMandante: null,
          golsVisitante: null,
        });
        expect((await acoes()).at(-1)).toMatchObject({
          ferramenta: 'lancar_placares',
          ok: true,
        });
      });
      it('jogo fora da rodada → isError e nada grava (nem o jogo válido)', async () => {
        const r = await chamar('lancar_placares', {
          rodada: 36,
          placares: [
            {
              mandanteId: c[0],
              visitanteId: c[1],
              golsMandante: 2,
              golsVisitante: 2,
            },
            {
              mandanteId: c[1],
              visitanteId: c[2],
              golsMandante: 1,
              golsVisitante: 0,
            },
          ],
        });
        expect(r.result!.isError).toBe(true);
        expect((await placares(36)).every((x) => x.golsMandante === null)).toBe(
          true,
        );
        expect((await acoes()).at(-1)).toMatchObject({ ok: false });
      });
      it('placar 100 → isError e nada grava', async () => {
        const r = await chamar('lancar_placares', {
          rodada: 36,
          placares: [
            {
              mandanteId: c[0],
              visitanteId: c[1],
              golsMandante: 100,
              golsVisitante: 0,
            },
          ],
        });
        expect(r.result!.isError).toBe(true);
        expect((await placares(36)).every((x) => x.golsMandante === null)).toBe(
          true,
        );
      });
      it('rodada fechada → isError RODADA_FECHADA e os outros jogos ficam intactos', async () => {
        await prisma.jogo.updateMany({
          where: { rodadaNumero: 36 },
          data: { golsMandante: 0, golsVisitante: 0 },
        });
        await prisma.rodada.update({
          where: { numero: 36 },
          data: { fechadaEm: new Date() },
        });
        const r = await chamar('lancar_placares', {
          rodada: 36,
          placares: [
            {
              mandanteId: c[0],
              visitanteId: c[1],
              golsMandante: 5,
              golsVisitante: 0,
            },
          ],
        });
        expect(r.result!.isError).toBe(true);
        expect(texto(r)).toMatch(/^RODADA_FECHADA: /);
        expect((await placares(36)).every((x) => x.golsMandante === 0)).toBe(
          true,
        );
      });
      it('rodada inexistente → isError', async () => {
        expect(
          (await chamar('lancar_placares', { rodada: 99, placares: [] }))
            .result!.isError,
        ).toBe(true);
      });
    });

    it('lancar_placares_copa troca só o jogo pedido, com pênaltis', async () => {
      await request(http())
        .put(`/api/admin/copa/fases/${faseId}/jogos`)
        .set('Origin', ORIGIN)
        .set('Cookie', admin.cookie)
        .send({
          jogos: [jogo(c[0], c[1], null, null), jogo(c[2], c[3], null, null)],
        })
        .expect(204);
      const r = await chamar('lancar_placares_copa', {
        faseId,
        placares: [
          {
            mandanteId: c[0],
            visitanteId: c[1],
            golsMandante: 1,
            golsVisitante: 1,
            penaltisMandante: 4,
            penaltisVisitante: 3,
          },
        ],
      });
      expect(r.result!.isError).toBeFalsy();
      const js = await prisma.copaJogo.findMany({ where: { faseId } });
      expect(js.find((j) => j.mandanteId === c[0])).toMatchObject({
        golsMandante: 1,
        penaltisMandante: 4,
        penaltisVisitante: 3,
      });
      expect(js.find((j) => j.mandanteId === c[2])!.golsMandante).toBeNull();
      const fora = await chamar('lancar_placares_copa', {
        faseId,
        placares: [
          {
            mandanteId: c[1],
            visitanteId: c[2],
            golsMandante: 1,
            golsVisitante: 0,
          },
        ],
      });
      expect(fora.result!.isError).toBe(true);
    });
  });

  describe('postar_no_clube', () => {
    const b64 = (b: Buffer) => b.toString('base64');
    const img = (extra = 0) => ({
      cheia: b64(montarJpeg(1080, 1350, extra)),
      mini: b64(montarJpeg(320, 400)),
    });
    const darClube = (id: string | null) =>
      prisma.club.update({ where: { id: c[0] }, data: { coachId: id } });
    const postsDoAdmin = () =>
      prisma.post.count({ where: { authorId: admin.id } });
    const amostras = gerarAmostras();
    let dir: string;
    beforeAll(async () => {
      dir = await mkdtemp(join(tmpdir(), 'im-mcp-'));
      vi.stubEnv('UPLOADS_DIR', dir);
    });
    afterAll(async () => {
      amostras.limpar();
      await rm(dir, { recursive: true, force: true });
    });

    it('admin sem clube → isError SEM_CLUBE e nada gravado', async () => {
      await darClube(null);
      const antes = await postsDoAdmin();
      const r = await chamar('postar_no_clube', {
        legenda: 'mcp-sem clube',
        imagens: [img()],
      });
      expect(r.result!.isError).toBe(true);
      expect(texto(r)).toMatch(/^SEM_CLUBE: /);
      expect(await postsDoAdmin()).toBe(antes);
      expect(arquivosEm(dir)).toEqual([]);
    });

    it('2 imagens (cheia + mini): post do clube do admin com 2 PostImage; log só com {legenda, imagens: 2}', async () => {
      await darClube(admin.id);
      const r = await chamar('postar_no_clube', {
        legenda: 'mcp-duas fotos',
        imagens: [img(), img()],
      });
      expect(r.result!.isError).toBeFalsy();
      const { id } = JSON.parse(texto(r));
      const p = await prisma.post.findUnique({
        where: { id },
        include: { images: true },
      });
      expect(p).toMatchObject({
        clubId: c[0],
        authorId: admin.id,
        caption: 'mcp-duas fotos',
      });
      expect(p!.images).toHaveLength(2);
      const a = (await acoes())
        .filter((x) => x.ferramenta === 'postar_no_clube' && x.ok)
        .at(-1)!;
      expect(a.entrada).toEqual({ legenda: 'mcp-duas fotos', imagens: 2 });
      expect(JSON.stringify(a.entrada).length).toBeLessThan(2048);
      const lista = (await comAdmin('/api/admin/mcp', admin).expect(200))
        .body as { resumo: string }[];
      expect(
        lista.some(
          (x) => x.resumo === "post do clube: 'mcp-duas fotos' · 2 imagens",
        ),
      ).toBe(true);
    });

    it('vídeo curto (MP4 4:5): cria PostVideo; log {legenda, video: true}', async () => {
      const r = await chamar('postar_no_clube', {
        legenda: 'mcp-video',
        video: b64(amostras.curto),
      });
      expect(r.result!.isError).toBeFalsy();
      const { id } = JSON.parse(texto(r));
      expect(await prisma.postVideo.count({ where: { postId: id } })).toBe(1);
      const a = (await acoes())
        .filter((x) => x.ferramenta === 'postar_no_clube' && x.ok)
        .at(-1)!;
      expect(a.entrada).toEqual({ legenda: 'mcp-video', video: true });
    });

    it('imagens e vídeo juntos, mini faltando, nenhum dos dois, base64 inválido → isError e nada gravado', async () => {
      const antes = await postsDoAdmin();
      const arquivos = arquivosEm(dir).length;
      const falta = { cheia: b64(montarJpeg(1080, 1350)) };
      for (const args of [
        { legenda: 'mcp-x', imagens: [img()], video: b64(amostras.curto) },
        { legenda: 'mcp-x', imagens: [img(), falta] },
        { legenda: 'mcp-x', imagens: [falta] },
        { legenda: 'mcp-x' },
        { legenda: 'mcp-x', imagens: [] },
        { legenda: 'mcp-x', imagens: Array(11).fill(img()) },
        { legenda: 'mcp-x', imagens: [{ cheia: 5, mini: 5 }] },
        { legenda: 'mcp-x', video: 'isto não é um mp4' },
      ]) {
        const r = await chamar('postar_no_clube', args);
        expect(r.result!.isError, JSON.stringify(args).slice(0, 80)).toBe(true);
        expect(texto(r)).toMatch(
          /^(DADOS_INVALIDOS|IMAGEM_INVALIDA|VIDEO_INVALIDO): /,
        );
      }
      expect(await postsDoAdmin()).toBe(antes);
      expect(arquivosEm(dir).length).toBe(arquivos);
      expect(
        (await acoes()).filter(
          (x) => x.ferramenta === 'postar_no_clube' && !x.ok,
        ).length,
      ).toBeGreaterThanOrEqual(8);
    });

    it('corpo de ~5 MB passa; acima de 64 MB → 413 claro (não 500); o /api segue com 1 MB', async () => {
      const grande = await chamar('postar_no_clube', {
        legenda: 'mcp-5mb',
        imagens: [img(1_900_000), img(1_900_000)],
      });
      expect(grande.result!.isError).toBeFalsy();
      // corpo real de 1 byte acima do limite, mandado com http puro (o supertest esconde erro de socket): a resposta é 413, não EPIPE
      const corpo = Buffer.alloc(64 * 1024 * 1024 + 1, 'a');
      const servidor = http().listen(0) as import('node:http').Server;
      const { port } = servidor.address() as import('node:net').AddressInfo;
      const resposta = await new Promise<{ status: number; corpo: string }>(
        (resolver, rejeitar) => {
          const req = httpRequest(
            {
              port,
              method: 'POST',
              path: '/mcp',
              headers: {
                Authorization: `Bearer ${CHAVE}`,
                'Content-Type': 'application/json',
                Accept: 'application/json, text/event-stream',
                'Content-Length': corpo.length,
                'X-Forwarded-For': '10.79.0.1',
              },
            },
            (res) => {
              let texto = '';
              res.on('data', (d: Buffer) => (texto += d));
              res.on('end', () =>
                resolver({ status: res.statusCode!, corpo: texto }),
              );
            },
          );
          req.on('error', rejeitar);
          req.end(corpo);
        },
      );
      expect(resposta.status).toBe(413);
      expect(JSON.parse(resposta.corpo)).toMatchObject({ statusCode: 413 });
      const api = await request(http())
        .post('/api/auth/entrar')
        .set('Origin', ORIGIN)
        .set('Content-Type', 'application/json')
        .send(
          JSON.stringify({ email: 'a@b.co', senha: 'x'.repeat(1_200_000) }),
        );
      expect(api.status).toBe(413);
    });

    it('corpo grande sem chave não é lido: 401, nunca estoura memória', async () => {
      // 3 MB com chave errada: 401 (nunca 413, que diria que o corpo foi lido e viraria oráculo da chave)
      const r = await rpc(
        {
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: { name: 'x', arguments: { a: 'x'.repeat(3 * 1024 * 1024) } },
        },
        'errada',
      );
      expect(r.status).toBe(401);
    });
  });

  describe('leitura', () => {
    it('as 6 ferramentas de leitura respondem sem gravar McpAcao; comentários sem e-mail', async () => {
      const antes = await prisma.mcpAcao.count();
      const p = await prisma.post.findFirst({
        where: { texto: 'mcp-oi galera' },
      });
      if (p)
        await prisma.comment.create({
          data: { postId: p.id, userId: torcedor.id, text: 'mcp-comentario' },
        });
      for (const n of [
        'ultimos_posts',
        'ultimos_comentarios',
        'tabela',
        'calendario',
        'bolao_ranking',
      ]) {
        const r = await chamar(n, n.startsWith('ultimos') ? { limite: 5 } : {});
        expect(r.result!.isError, n).toBeFalsy();
        expect(() => JSON.parse(texto(r)), n).not.toThrow();
      }
      expect(await prisma.mcpAcao.count()).toBe(antes);
      const com = texto(await chamar('ultimos_comentarios', { limite: 50 }));
      expect(com).toContain('mcp-comentario');
      expect(com).not.toMatch(/@exemplo\.com|email/i);
      expect(texto(await chamar('ultimos_posts', { limite: 30 }))).toContain(
        'mcp-oi galera',
      );
      expect(
        (await chamar('ultimos_posts', { limite: 31 })).result!.isError,
      ).toBe(true);
    });
    it('ferramenta desconhecida → isError', async () => {
      expect((await chamar('nao_existe')).result!.isError).toBe(true);
    });
  });

  describe('GET /api/admin/mcp', () => {
    it('só o admin; devolve resumo curto e não a entrada', async () => {
      await comAdmin('/api/admin/mcp', torcedor).expect(403);
      await chamar('criar_post', { texto: 'mcp-' + 'x'.repeat(100) });
      const lista = (await comAdmin('/api/admin/mcp', admin).expect(200))
        .body as {
        id: string;
        ferramenta: string;
        resumo: string;
        ok: boolean;
        erro: string | null;
        criadaEm: string;
        entrada?: unknown;
      }[];
      expect(lista.length).toBeLessThanOrEqual(100);
      const item = lista.find(
        (a) =>
          a.ferramenta === 'criar_post' &&
          a.resumo.startsWith("post: 'mcp-xxx"),
      )!;
      expect(item).toEqual({
        id: expect.any(String),
        ferramenta: 'criar_post',
        resumo: expect.any(String),
        ok: true,
        erro: null,
        criadaEm: expect.any(String),
      });
      expect(item.resumo.length).toBeLessThanOrEqual(70);
      const placar = lista.find((a) => a.resumo.startsWith('rodada 36'));
      expect(placar?.resumo).toBe('rodada 36 · 1 placares');
    });
  });
});
