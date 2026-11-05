import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { vi } from 'vitest';
import { ConquistasService } from '../src/conquistas/conquistas.service.js';
import { StoriesEventos } from '../src/stories/stories.eventos.js';
import type { PrismaService } from '../src/prisma.service.js';
import { apagarClubesDeTeste, cadastrarUsuario, criarApp, criarClubesDeTeste, ORIGIN } from './helpers.js';

// Rodadas 27 a 31, fases de ordem 81 e 82 e clubes teste-conquistas-N são só deste arquivo (os e2e rodam em sequência no mesmo banco).
describe('XP, níveis e conquistas (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let post: Awaited<ReturnType<typeof criarApp>>['post'];
  let http: () => ReturnType<INestApplication['getHttpServer']>;
  let conquistas: ConquistasService;
  type U = Awaited<ReturnType<typeof cadastrarUsuario>>;
  let admin: U, ana: U, bruno: U, carla: U, dani: U;
  let c: string[];
  const usuarios: string[] = [];
  const RODADAS = [27, 28, 29, 30, 31];
  const SEMEADA = 'conquistas.semeadas';
  const com = (m: 'get' | 'put' | 'post', url: string, u: U) => request(http())[m](url).set('Origin', ORIGIN).set('Cookie', u.cookie);
  const d = (iso: string) => new Date(iso);
  /** Rodada fechada em `quando` com os jogos dados (mandante, visitante, gols). */
  const fechada = async (n: number, quando: Date | null, jogos: [string, string, number, number][]) => {
    await prisma.jogo.deleteMany({ where: { rodadaNumero: n } });
    await prisma.jogo.createMany({ data: jogos.map(([m, v, gm, gv]) => ({ rodadaNumero: n, mandanteId: m, visitanteId: v, golsMandante: gm, golsVisitante: gv })) });
    await prisma.rodada.update({ where: { numero: n }, data: { fechadaEm: quando } });
  };
  const perfil = async (u: U, quem: U = u) => (await com('get', `/api/pessoas/${quem.id}`, u).expect(200)).body as { nivel: { xp: number; nome: string; min: number; proximo: number | null }; conquistas: { tipo: string; nome: string; vezes: number; ultimaEm: string }[] };
  const tipos = async (u: U) => (await perfil(u)).conquistas.map((x) => x.tipo).sort();
  const atividadeDe = (u: U) => prisma.notificacao.findMany({ where: { userId: u.id, tipo: 'CONQUISTA' } });
  const postsCbf = (u: U) => prisma.post.findMany({ where: { clubId: 'cbf', texto: { contains: u.id } } });
  const semear = () => prisma.setting.upsert({ where: { key: SEMEADA }, update: {}, create: { key: SEMEADA, value: new Date().toISOString() } });
  const limpar = async () => {
    await prisma.conquista.deleteMany({ where: { userId: { in: usuarios } } });
    await prisma.notificacao.deleteMany({ where: { userId: { in: usuarios } } });
    await prisma.post.deleteMany({ where: { OR: [{ authorId: { in: usuarios } }, { clubId: 'cbf', texto: { contains: '@[' } }] } });
    await prisma.palpite.deleteMany({ where: { userId: { in: usuarios } } });
    await prisma.selo.deleteMany({ where: { clubId: { in: c } } });
    await prisma.story.deleteMany({ where: { autorId: { in: usuarios } } });
    await prisma.jogo.deleteMany({ where: { rodadaNumero: { in: RODADAS } } });
    await prisma.rodada.updateMany({ where: { numero: { in: RODADAS } }, data: { fechadaEm: null, prazoPalpite: null } });
    await prisma.copaFase.deleteMany({ where: { ordem: { in: [81, 82] } } });
    await prisma.coachTenure.deleteMany({ where: { clubId: { in: c } } });
    await prisma.club.updateMany({ where: { id: { in: c } }, data: { coachId: null } });
  };
  /** Dá o clube à pessoa como técnico desde `desde` (até `ate`, ou ainda hoje). */
  const tecnico = async (u: U, clubeId: string, desde: Date, ate: Date | null = null) => {
    await prisma.coachTenure.create({ data: { clubId: clubeId, userId: u.id, startedAt: desde, endedAt: ate } });
    await prisma.club.update({ where: { id: clubeId }, data: { coachId: ate ? null : u.id } });
  };

  beforeAll(async () => {
    ({ app, prisma, post, http } = await criarApp());
    conquistas = app.get(ConquistasService);
    c = await criarClubesDeTeste(prisma, 'conquistas', 4);
    ana = await cadastrarUsuario(post, prisma, null, 'Ana Conquistas');
    bruno = await cadastrarUsuario(post, prisma, null, 'Bruno Conquistas');
    carla = await cadastrarUsuario(post, prisma, null, 'Carla Conquistas');
    dani = await cadastrarUsuario(post, prisma, null, 'Dani Conquistas');
    admin = await cadastrarUsuario(post, prisma, null, 'Admin Conquistas');
    usuarios.push(ana.id, bruno.id, carla.id, dani.id, admin.id);
    await prisma.user.update({ where: { id: admin.id }, data: { isAdmin: true } });
  });
  beforeEach(async () => {
    await limpar();
    await semear(); // a maioria dos testes parte do estado "já semeado": conquista nova anuncia
  });
  afterAll(async () => {
    await limpar();
    await prisma.user.deleteMany({ where: { id: { in: usuarios } } });
    await apagarClubesDeTeste(prisma, c);
    await app.close();
  });

  it('troca de técnico no meio da temporada: a vitória antiga fica com o técnico antigo e a nova vai para o novo', async () => {
    await tecnico(ana, c[0], d('2026-01-01'), d('2026-06-01'));
    await tecnico(bruno, c[0], d('2026-06-01'));
    await fechada(28, d('2026-03-01'), [[c[0], c[1], 3, 0]]); // no tempo da Ana, goleada
    await fechada(29, d('2026-08-01'), [[c[0], c[2], 1, 0]]); // no tempo do Bruno, vitória magra
    await conquistas.verificar();
    expect((await perfil(ana)).nivel).toMatchObject({ xp: 10, nome: 'Estagiário', min: 0, proximo: 100 });
    expect((await perfil(bruno)).nivel.xp).toBe(10);
    expect(await tipos(ana)).toEqual(['GOLEADA', 'LIDER', 'PRIMEIRA_VITORIA']); // líder após a 28, no tempo dela
    expect(await tipos(bruno)).toEqual(['LIDER', 'PRIMEIRA_VITORIA']); // líder após a 29; o 3×0 não é dele
  });

  it('rodada reaberta e placar mudado: XP não conta, a conquista dada fica e não sai de novo', async () => {
    await tecnico(carla, c[2], d('2026-01-01'));
    await fechada(30, d('2026-03-01'), [[c[2], c[3], 3, 0]]);
    await conquistas.verificar();
    expect(await tipos(carla)).toEqual(['GOLEADA', 'LIDER', 'PRIMEIRA_VITORIA']);
    expect((await perfil(carla)).nivel.xp).toBe(10);

    await prisma.rodada.update({ where: { numero: 30 }, data: { fechadaEm: null } }); // reaberta, ainda com o 3×0 lançado
    await conquistas.verificar();
    expect((await perfil(carla)).nivel.xp).toBe(0); // rodada aberta não conta, mesmo com placar de vitória
    expect((await perfil(carla)).conquistas).toHaveLength(3); // e nada foi retirado

    await prisma.jogo.updateMany({ where: { rodadaNumero: 30 }, data: { golsMandante: 0, golsVisitante: 2 } }); // o placar muda com ela aberta
    await conquistas.verificar();
    expect((await perfil(carla)).nivel.xp).toBe(0);

    await prisma.jogo.updateMany({ where: { rodadaNumero: 30 }, data: { golsMandante: 1, golsVisitante: 0 } }); // fecha de novo, agora vitória magra
    await prisma.rodada.update({ where: { numero: 30 }, data: { fechadaEm: d('2026-03-02') } });
    await conquistas.verificar();
    const p = await perfil(carla);
    expect(p.nivel.xp).toBe(10); // voltou a contar, com o placar novo
    expect(p.conquistas.map((x) => x.vezes)).toEqual([1, 1, 1]); // não duplicou
    expect(await atividadeDe(carla)).toHaveLength(3); // e não anunciou de novo
    expect(await postsCbf(carla)).toHaveLength(3);
  });

  it('dois verificar ao mesmo tempo geram uma conquista só (uma atividade, um post)', async () => {
    await tecnico(carla, c[2], d('2026-01-01'));
    await fechada(31, d('2026-03-01'), [[c[2], c[3], 1, 0]]);
    await Promise.all([conquistas.verificar(), conquistas.verificar(), conquistas.verificar([carla.id])]);
    expect(await prisma.conquista.count({ where: { userId: carla.id } })).toBe(2); // primeira vitória e líder
    expect(await atividadeDe(carla)).toHaveLength(2);
    expect(await postsCbf(carla)).toHaveLength(2);

    // a corrida de verdade: outro verificar gravou entre a leitura e a escrita deste (a leitura do que já existe vem velha)
    const velha = vi.spyOn(prisma.conquista, 'findMany').mockResolvedValue([]);
    await conquistas.verificar([carla.id]);
    velha.mockRestore();
    expect(await prisma.conquista.count({ where: { userId: carla.id } })).toBe(2);
    expect(await atividadeDe(carla)).toHaveLength(2); // quem não gravou não anuncia
    expect(await postsCbf(carla)).toHaveLength(2);
  });

  it('a primeira execução grava o histórico em silêncio; a conquista nova depois anuncia (atividade, push e post da CBF com a menção)', async () => {
    await prisma.setting.delete({ where: { key: SEMEADA } }).catch(() => undefined);
    await tecnico(carla, c[2], d('2026-01-01'));
    await fechada(28, d('2026-03-01'), [[c[2], c[3], 2, 0]]);
    await conquistas.verificar();
    expect(await tipos(carla)).toEqual(['LIDER', 'PRIMEIRA_VITORIA']); // gravou o histórico
    expect(await atividadeDe(carla)).toHaveLength(0); // sem atividade
    expect(await postsCbf(carla)).toHaveLength(0); // e sem post
    expect(await prisma.setting.findUnique({ where: { key: SEMEADA } })).not.toBeNull();

    await tecnico(dani, c[0], d('2026-01-01'));
    await fechada(29, d('2026-03-05'), [[c[0], c[1], 1, 0]]);
    await conquistas.verificar();
    expect(await atividadeDe(dani)).toMatchObject([{ tipo: 'CONQUISTA', conquistaTipo: 'PRIMEIRA_VITORIA' }]);
    const [p] = await postsCbf(dani);
    expect(p.texto).toBe(`🏆 @[Dani Conquistas](${dani.id}) conquistou *Primeira vitória*!`);
    expect(p.clubId).toBe('cbf');
    const itens = (await com('get', '/api/atividade', dani).expect(200)).body.itens as { tipo: string; conquista?: { tipo: string; nome: string } }[];
    expect(itens).toMatchObject([{ tipo: 'CONQUISTA', conquista: { tipo: 'PRIMEIRA_VITORIA', nome: 'Primeira vitória' } }]);
  });

  it('REI_BOLAO vai para os dois empatados no topo e é repetível, uma por rodada', async () => {
    await fechada(28, d('2026-03-01'), [[c[0], c[1], 2, 1]]);
    await fechada(29, d('2026-04-01'), [[c[0], c[1], 0, 0]]);
    const [j28] = await prisma.jogo.findMany({ where: { rodadaNumero: 28 } });
    const [j29] = await prisma.jogo.findMany({ where: { rodadaNumero: 29 } });
    const palpite = (u: U, jogoId: string, gm: number, gv: number) => prisma.palpite.create({ data: { userId: u.id, jogoId, golsMandante: gm, golsVisitante: gv } });
    await palpite(ana, j28.id, 2, 1); // exato (3)
    await palpite(bruno, j28.id, 2, 1); // exato (3): empate no topo
    await palpite(carla, j28.id, 0, 1); // errou (0)
    await palpite(ana, j29.id, 0, 0); // exato na 29; ninguém mais palpitou
    await conquistas.verificar();
    const rei = async (u: U) => (await perfil(u)).conquistas.find((x) => x.tipo === 'REI_BOLAO');
    expect(await rei(ana)).toMatchObject({ nome: 'Rei do bolão', vezes: 2 });
    expect(await rei(bruno)).toMatchObject({ vezes: 1 });
    expect(await rei(carla)).toBeUndefined();
    expect((await prisma.conquista.findMany({ where: { userId: ana.id, tipo: 'REI_BOLAO' }, orderBy: { refId: 'asc' } })).map((x) => x.refId)).toEqual(['r28', 'r29']);
    // palpites exatos valem XP (5 cada): ana 2, bruno 1
    expect((await perfil(ana)).nivel.xp).toBe(10);
    expect((await perfil(bruno)).nivel.xp).toBe(5);
  });

  it('LIDER (clube fecha a rodada em 1º) e CAMPEAO_COPA (vence o jogo único da fase final fechada) saem dos eventos reais de fechar', async () => {
    await tecnico(ana, c[0], d('2026-01-01'));
    await tecnico(bruno, c[1], d('2026-01-01'));
    await prisma.rodada.updateMany({ where: { numero: { in: [28, 29] } }, data: { fechadaEm: null } });
    const lancar = (n: number, jogos: unknown) => com('put', `/api/admin/rodadas/${n}/jogos`, admin).send({ jogos }).expect(204);
    await lancar(28, [{ mandanteId: c[0], visitanteId: c[1], golsMandante: 2, golsVisitante: 0 }]);
    await com('post', '/api/admin/rodadas/28/fechar', admin).expect(204);
    await vi.waitFor(async () => expect(await tipos(ana)).toEqual(['LIDER', 'PRIMEIRA_VITORIA']));
    expect(await tipos(bruno)).toEqual([]);

    // Copa: semifinal (2 jogos) e final (1 jogo); só a final conta
    const semi = (await com('post', '/api/admin/copa/fases', admin).send({ nome: 'Semi teste', ordem: 81 }).expect(201)).body.id as string;
    const final = (await com('post', '/api/admin/copa/fases', admin).send({ nome: 'Final teste', ordem: 82 }).expect(201)).body.id as string;
    await tecnico(carla, c[2], d('2026-01-01'));
    const copa = (id: string, jogos: unknown) => com('put', `/api/admin/copa/fases/${id}/jogos`, admin).send({ jogos }).expect(204);
    await copa(semi, [{ mandanteId: c[2], visitanteId: c[3], golsMandante: 1, golsVisitante: 0 }, { mandanteId: c[0], visitanteId: c[1], golsMandante: 0, golsVisitante: 1 }]);
    await com('post', `/api/admin/copa/fases/${semi}/fechar`, admin).expect(201);
    await vi.waitFor(async () => expect(await tipos(carla)).toEqual(['PRIMEIRA_VITORIA']));
    await copa(final, [{ mandanteId: c[2], visitanteId: c[1], golsMandante: 1, golsVisitante: 1, penaltisMandante: 4, penaltisVisitante: 3 }]);
    await com('post', `/api/admin/copa/fases/${final}/fechar`, admin).expect(201);
    await vi.waitFor(async () => expect(await tipos(carla)).toEqual(['CAMPEAO_COPA', 'PRIMEIRA_VITORIA']));
    // empate nos pênaltis vale empate (3) e não vitória: 10 (semi) + 3 (final)
    expect((await perfil(carla)).nivel.xp).toBe(13);
  });

  it('COMUNICADOR com 100 posts, PRIMEIRO_STORY e XP de posts, reações (teto 50 por post, sem a do autor) e selos', async () => {
    await tecnico(ana, c[0], d('2026-01-01'));
    await prisma.post.createMany({ data: Array.from({ length: 99 }, () => ({ clubId: c[0], authorId: ana.id, caption: 'x' })) });
    const cem = (await com('post', '/api/posts', ana).send({ texto: 'o centésimo' }).expect(201)).body.id as string;
    await vi.waitFor(async () => expect(await tipos(ana)).toEqual(['COMUNICADOR']), { timeout: 5000 });
    // post oculto e post da CBF não contam: 100 × 5 = 500 de posts
    await prisma.post.update({ where: { id: cem }, data: { hiddenAt: new Date() } });
    expect((await perfil(ana)).nivel.xp).toBe(99 * 5);
    await prisma.post.update({ where: { id: cem }, data: { hiddenAt: null } });

    // 60 reações em um post (conta 50) + a do próprio autor (não conta) + 3 em outro
    const outros = await Promise.all(Array.from({ length: 63 }, async (_, i) => (await prisma.user.create({ data: { email: `rx-${i}-${ana.id}@exemplo.com`, passwordHash: 'x', name: `Fã ${i}` } })).id));
    try {
      const [a, b] = await prisma.post.findMany({ where: { authorId: ana.id }, take: 2, orderBy: { id: 'asc' } });
      await prisma.like.createMany({ data: [...outros.slice(0, 60).map((userId) => ({ postId: a.id, userId })), { postId: a.id, userId: ana.id }, ...outros.slice(60).map((userId) => ({ postId: b.id, userId }))] });
      await prisma.selo.create({ data: { clubId: c[0], titulo: 'Melhor', votacaoId: (await prisma.votacao.create({ data: { titulo: 'v', tipo: 'CLUBE', opcoes: [], prazo: new Date(), criadaPor: admin.id } })).id } });
      expect((await perfil(ana)).nivel).toMatchObject({ xp: 100 * 5 + 50 + 3 + 20, nome: 'Técnico', min: 300, proximo: 700 });

      const story = await prisma.story.create({ data: { clubId: c[0], autorId: ana.id, tipo: 'IMAGEM', path: '/x.jpg', largura: 1, altura: 1, expiraEm: new Date(Date.now() + 3_600_000) } });
      app.get(StoriesEventos).emit('stories.criado', story.id);
      await vi.waitFor(async () => expect(await tipos(ana)).toEqual(['COMUNICADOR', 'PRIMEIRO_STORY']));
    } finally {
      await prisma.user.deleteMany({ where: { id: { in: outros } } });
      await prisma.votacao.deleteMany({ where: { criadaPor: admin.id } });
    }
  });

  it('INVICTO_5: cinco rodadas seguidas sem perder no mesmo clube', async () => {
    await tecnico(ana, c[0], d('2026-01-01'));
    const r = [28, 29, 30, 31];
    await Promise.all(r.map((n, i) => fechada(n, d(`2026-0${i + 1}-10`), [[c[0], c[1], 1, i === 3 ? 1 : 0]])));
    await conquistas.verificar();
    expect(await tipos(ana)).toEqual(['LIDER', 'PRIMEIRA_VITORIA']); // só 4 jogos
    await fechada(27, d('2026-05-10'), [[c[1], c[0], 0, 0]]);
    await conquistas.verificar();
    expect(await tipos(ana)).toEqual(['INVICTO_5', 'LIDER', 'PRIMEIRA_VITORIA']);
  });

  it('o perfil traz nivel e conquistas e nunca e-mail nem hash', async () => {
    await tecnico(ana, c[0], d('2026-01-01'));
    await fechada(28, d('2026-03-01'), [[c[0], c[1], 3, 0]]);
    await conquistas.verificar();
    const res = await com('get', `/api/pessoas/${ana.id}`, bruno).expect(200);
    expect(res.body.nivel).toEqual({ xp: 10, nome: 'Estagiário', min: 0, proximo: 100 });
    expect(res.body.conquistas).toHaveLength(3);
    expect(res.body.conquistas).toContainEqual({ tipo: 'GOLEADA', nome: 'Goleada', vezes: 1, ultimaEm: expect.any(String) });
    const cru = JSON.stringify(res.body);
    expect(cru).not.toContain(ana.email);
    expect(cru).not.toMatch(/passwordHash|email/i);
  });
});
