import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { PrismaService } from '../src/prisma.service.js';
import { apagarClubesDeTeste, cadastrarUsuario, convite, criarApp, criarClubesDeTeste, novoEmail, ORIGIN } from './helpers.js';

// Rodadas 37 e 38 e clubes teste-liga-N são só deste arquivo (os e2e rodam em paralelo no mesmo banco).
describe('liga: CBF, rodadas, jogos e tabela (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let post: Awaited<ReturnType<typeof criarApp>>['post'];
  let http: () => ReturnType<INestApplication['getHttpServer']>;
  type U = Awaited<ReturnType<typeof cadastrarUsuario>>;
  let admin: U, tecnico: U, torcedor: U;
  let c: string[];
  const usuarios: string[] = [];
  const com = (m: 'get' | 'put' | 'post' | 'delete', url: string, u: U) => request(http())[m](url).set('Origin', ORIGIN).set('Cookie', u.cookie);
  const jogo = (m: string, v: string, gm: number, gv: number) => ({ mandanteId: m, visitanteId: v, golsMandante: gm, golsVisitante: gv });
  const lancar = (n: number, jogos: unknown, u: U = admin) => com('put', `/api/admin/rodadas/${n}/jogos`, u).send({ jogos });
  const tabela = async () => (await com('get', '/api/liga/tabela', torcedor).expect(200)).body as { clubeId: string; posicao: number; P: number; J: number; ultimos: string[] }[];
  const minha = async () => (await tabela()).filter((l) => c.includes(l.clubeId));
  const jogosDe = (n: number) => prisma.jogo.count({ where: { rodadaNumero: n } });

  beforeAll(async () => {
    ({ app, prisma, post, http } = await criarApp());
    c = await criarClubesDeTeste(prisma, 'liga', 4);
    tecnico = await cadastrarUsuario(post, prisma, c[0], 'Técnico');
    torcedor = await cadastrarUsuario(post, prisma, null, 'Torcedor');
    admin = await cadastrarUsuario(post, prisma, null, 'Admin');
    usuarios.push(tecnico.id, torcedor.id, admin.id);
    await prisma.user.update({ where: { id: admin.id }, data: { isAdmin: true } });
  });
  afterEach(async () => {
    await prisma.jogo.deleteMany({ where: { rodadaNumero: { in: [37, 38] } } });
    await prisma.rodada.updateMany({ where: { numero: { in: [37, 38] } }, data: { fechadaEm: null } });
    await prisma.post.deleteMany({ where: { authorId: admin.id } });
  });
  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: usuarios } } });
    await apagarClubesDeTeste(prisma, c);
    await app.close();
  });

  describe('rodadas e jogos', () => {
    it('GET /liga/rodadas traz as 38 rodadas, abertas, com os jogos lançados', async () => {
      await lancar(37, [jogo(c[0], c[1], 2, 1)]).expect(204);
      const r = (await com('get', '/api/liga/rodadas', torcedor).expect(200)).body;
      expect(r).toHaveLength(38);
      expect(r[0]).toEqual({ numero: 1, fechada: false, jogos: expect.any(Array) });
      expect(r[36]).toMatchObject({ numero: 37, fechada: false, jogos: [{ mandante: { id: c[0], nome: expect.any(String), escudoUrl: expect.any(String) }, visitante: { id: c[1] }, golsMandante: 2, golsVisitante: 1 }] });
    });

    it('clube repetido na rodada → 400 e nada gravado (nem os jogos válidos)', async () => {
      await lancar(37, [jogo(c[0], c[1], 1, 0), jogo(c[2], c[0], 1, 0)]).expect(400); // c0 joga 2 vezes
      await lancar(37, [jogo(c[0], c[1], 1, 0), jogo(c[0], c[1], 2, 2)]).expect(400); // jogo repetido
      await lancar(37, [jogo(c[0], c[0], 1, 0)]).expect(400); // contra si mesmo
      expect(await jogosDe(37)).toBe(0);
    });

    it('placar inválido (-1, 100, fracionado, texto) → 400; clube inexistente ou a CBF → 400/404 sem gravar', async () => {
      for (const g of [jogo(c[0], c[1], -1, 0), jogo(c[0], c[1], 0, 100), jogo(c[0], c[1], 1.5, 0), { ...jogo(c[0], c[1], 0, 0), golsMandante: '2' }])
        expect((await lancar(37, [g]).expect(400)).body.codigo).toBe('DADOS_INVALIDOS');
      await lancar(37, [jogo(c[0], 'nao-existe', 1, 0)]).expect(400);
      await lancar(37, [jogo(c[0], 'cbf', 1, 0)]).expect(400);
      await lancar(37, 'x').expect(400);
      expect(await jogosDe(37)).toBe(0);
    });

    it('PUT substitui todos os jogos da rodada; lista vazia limpa', async () => {
      await lancar(37, [jogo(c[0], c[1], 1, 0), jogo(c[2], c[3], 0, 0)]).expect(204);
      await lancar(37, [jogo(c[1], c[2], 3, 3)]).expect(204);
      expect(await jogosDe(37)).toBe(1);
      await lancar(37, []).expect(204);
      expect(await jogosDe(37)).toBe(0);
    });

    it('rodada fora de 1–38 → 404; não-admin → 403', async () => {
      await lancar(0, []).expect(404);
      await lancar(39, []).expect(404);
      await lancar(37, [], tecnico).expect(403);
      await com('post', '/api/admin/rodadas/37/fechar', torcedor).expect(403);
      await com('post', '/api/admin/rodadas/37/reabrir', torcedor).expect(403);
    });
  });

  describe('fechar, reabrir e tabela', () => {
    it('rodada aberta não conta; fechar e reabrir recalcula a tabela', async () => {
      await lancar(37, [jogo(c[0], c[1], 2, 0), jogo(c[2], c[3], 1, 1)]).expect(204);
      expect((await minha()).every((l) => l.P === 0 && l.J === 0)).toBe(true);

      await com('post', '/api/admin/rodadas/37/fechar', admin).expect(204);
      let t = await minha();
      expect(t.find((l) => l.clubeId === c[0])).toMatchObject({ P: 3, J: 1, ultimos: ['V'] });
      expect(t.find((l) => l.clubeId === c[1])).toMatchObject({ P: 0, J: 1, ultimos: ['D'] });
      expect(t.find((l) => l.clubeId === c[2])).toMatchObject({ P: 1 });
      expect(t[0].clubeId).toBe(c[0]); // líder entre os de teste
      expect((await com('get', '/api/liga/rodadas', torcedor)).body[36].fechada).toBe(true);

      // reabrir, mudar o placar (c1 vira o vencedor) e fechar de novo
      await com('post', '/api/admin/rodadas/37/reabrir', admin).expect(204);
      expect((await minha()).every((l) => l.J === 0)).toBe(true);
      await lancar(37, [jogo(c[0], c[1], 0, 4), jogo(c[2], c[3], 1, 1)]).expect(204);
      await com('post', '/api/admin/rodadas/37/fechar', admin).expect(204);
      t = await minha();
      expect(t.find((l) => l.clubeId === c[1])).toMatchObject({ P: 3, ultimos: ['V'] });
      expect(t.find((l) => l.clubeId === c[0])).toMatchObject({ P: 0, ultimos: ['D'] });
    });

    it('ultimos vai do jogo mais recente ao mais antigo (por número da rodada)', async () => {
      await lancar(37, [jogo(c[0], c[1], 1, 0)]).expect(204);
      await lancar(38, [jogo(c[0], c[2], 0, 3)]).expect(204);
      await com('post', '/api/admin/rodadas/38/fechar', admin).expect(204); // fechada antes: a ordem é pelo número
      await com('post', '/api/admin/rodadas/37/fechar', admin).expect(204);
      expect((await minha()).find((l) => l.clubeId === c[0])?.ultimos).toEqual(['D', 'V']);
    });

    it('editar jogo de rodada fechada → 409; fechar duas vezes → 409; reabrir aberta → 409', async () => {
      await lancar(37, [jogo(c[0], c[1], 1, 0)]).expect(204);
      await com('post', '/api/admin/rodadas/37/fechar', admin).expect(204);
      expect((await lancar(37, [jogo(c[0], c[1], 5, 0)]).expect(409)).body.codigo).toBe('RODADA_FECHADA');
      expect(await prisma.jogo.count({ where: { rodadaNumero: 37, golsMandante: 1 } })).toBe(1);
      await com('post', '/api/admin/rodadas/37/fechar', admin).expect(409);
      await com('post', '/api/admin/rodadas/37/reabrir', admin).expect(204);
      expect((await com('post', '/api/admin/rodadas/37/reabrir', admin).expect(409)).body.codigo).toBe('RODADA_ABERTA');
    });

    it('fechar dispara o evento liga.rodadaFechada(n); inexistente → 404', async () => {
      const { LigaEventos } = await import('../src/liga/liga.eventos.js');
      const ouvido: number[] = [];
      app.get(LigaEventos).on('liga.rodadaFechada', (n: number) => ouvido.push(n));
      await com('post', '/api/admin/rodadas/37/fechar', admin).expect(204);
      expect(ouvido).toEqual([37]);
      await com('post', '/api/admin/rodadas/99/fechar', admin).expect(404);
    });

    it('a tabela só traz clubes não oficiais (sem a CBF)', async () => {
      expect((await tabela()).map((l) => l.clubeId)).not.toContain('cbf');
    });

    it('GET /clubes/:id traz liga {posicao, ultimos}; a CBF traz liga null', async () => {
      await lancar(37, [jogo(c[0], c[1], 2, 0)]).expect(204);
      await com('post', '/api/admin/rodadas/37/fechar', admin).expect(204);
      const t = await tabela();
      const perfil = (await com('get', `/api/clubes/${c[0]}`, torcedor).expect(200)).body;
      expect(perfil.liga).toEqual({ posicao: t.find((l) => l.clubeId === c[0])!.posicao, ultimos: ['V'], pontos: 3, jogos: 1 });
      expect((await com('get', '/api/clubes/cbf', torcedor).expect(200)).body).toMatchObject({ id: 'cbf', nome: 'CBF', liga: null, tecnico: null });
    });
  });

  describe('CBF', () => {
    it('fora de /clubes?livres=1, do cadastro e das trocas; nunca recebe técnico', async () => {
      const livres = (await request(http()).get('/api/clubes?livres=1').expect(200)).body;
      expect(livres.map((x: { id: string }) => x.id)).not.toContain('cbf');
      const todos = (await request(http()).get('/api/clubes').expect(200)).body;
      expect(todos.map((x: { id: string }) => x.id)).not.toContain('cbf');
      const cad = await post('/api/auth/cadastro', { convite: await convite(prisma), email: novoEmail(), senha: 'senha-boa-123', nome: 'Penetra', clubeId: 'cbf' }, '10.7.7.7');
      expect(cad.status).toBe(409);
      expect(await prisma.user.count({ where: { name: 'Penetra' } })).toBe(0); // a transação voltou atrás
      expect(await prisma.club.findUnique({ where: { id: 'cbf' } })).toMatchObject({ coachId: null, oficial: true });
      expect((await com('post', '/api/trocas', torcedor).send({ tipo: 'ASSUMIR', clubeId: 'cbf' }).expect(409)).body.codigo).toBe('CLUBE_OCUPADO');
    });

    it('não-admin comoCbf → 403; técnico com clube também', async () => {
      await com('post', '/api/posts', tecnico).field('comoCbf', 'true').field('texto', 'oi').expect(403);
      await com('post', '/api/posts', torcedor).field('comoCbf', 'true').field('texto', 'oi').expect(403);
    });

    it('admin comoCbf (sem clube) → post do clube cbf; sem o campo continua exigindo clube', async () => {
      const r = await com('post', '/api/posts', admin).field('comoCbf', 'true').field('texto', 'Comunicado da CBF').expect(201);
      expect(r.body).toMatchObject({ clube: { id: 'cbf', nome: 'CBF' }, texto: 'Comunicado da CBF', podeEditar: true });
      await com('post', '/api/posts', admin).field('texto', 'sem clube').expect(403);
      await com('post', '/api/posts', admin).field('comoCbf', 'false').field('texto', 'sem clube').expect(403);
    });
  });
});
