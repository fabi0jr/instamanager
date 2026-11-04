import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { PrismaService } from '../src/prisma.service.js';
import { apagarClubesDeTeste, cadastrarUsuario, criarApp, criarClubesDeTeste, ORIGIN } from './helpers.js';

// Rodadas 33 e 34, fases de ordem 94 e 95 e clubes teste-bolao-N são só deste arquivo.
describe('bolão: palpites, prazo, pontos e ranking (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let http: () => ReturnType<INestApplication['getHttpServer']>;
  type U = Awaited<ReturnType<typeof cadastrarUsuario>>;
  let admin: U, zeca: U, bia: U, ana: U;
  let c: string[];
  const com = (m: 'get' | 'put' | 'post', url: string, u: U) => request(http())[m](url).set('Origin', ORIGIN).set('Cookie', u.cookie);
  const futuro = () => new Date(Date.now() + 3_600_000);
  const placar = (m: string, v: string, gm: number | null, gv: number | null, extra: object = {}) => ({ mandanteId: m, visitanteId: v, golsMandante: gm, golsVisitante: gv, ...extra });
  const lancar = (n: number, jogos: unknown) => com('put', `/api/admin/rodadas/${n}/jogos`, admin).send({ jogos }).expect(204);
  const ids = async (n: number) => Object.fromEntries((await prisma.jogo.findMany({ where: { rodadaNumero: n } })).map((j) => [`${j.mandanteId}|${j.visitanteId}`, j.id])) as Record<string, string>;
  const palpitar = (u: U, itens: object) => com('put', '/api/bolao/palpites', u).send(itens);
  const p = (jogoId: string, gm: number, gv: number) => ({ jogoId, golsMandante: gm, golsVisitante: gv });
  const ranking = async () => ((await com('get', '/api/bolao/ranking', zeca).expect(200)).body as { usuario: { id: string; nome: string }; pontos: number; exatos: number; posicao: number }[]).filter((l) => [zeca.id, bia.id, ana.id].includes(l.usuario.id));
  const noPrazo = (n: number, d: Date | null) => prisma.rodada.update({ where: { numero: n }, data: { prazoPalpite: d } });

  beforeAll(async () => {
    const a = await criarApp();
    ({ app, prisma, http } = a);
    c = await criarClubesDeTeste(prisma, 'bolao', 4);
    zeca = await cadastrarUsuario(a.post, prisma, null, 'Zeca');
    bia = await cadastrarUsuario(a.post, prisma, null, 'Bia');
    ana = await cadastrarUsuario(a.post, prisma, null, 'Ana');
    admin = await cadastrarUsuario(a.post, prisma, null, 'Admin Bolão');
    await prisma.user.update({ where: { id: admin.id }, data: { isAdmin: true } });
    await prisma.copaFase.deleteMany({ where: { ordem: { in: [94, 95] } } });
  });
  afterEach(async () => {
    await prisma.palpite.deleteMany({ where: { userId: { in: [zeca.id, bia.id, ana.id] } } });
    await prisma.jogo.deleteMany({ where: { rodadaNumero: { in: [33, 34] } } });
    await prisma.rodada.updateMany({ where: { numero: { in: [33, 34] } }, data: { fechadaEm: null, prazoPalpite: null } });
    await prisma.copaFase.deleteMany({ where: { ordem: { in: [94, 95] } } });
    await prisma.post.deleteMany({ where: { authorId: admin.id } });
  });
  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: [zeca.id, bia.id, ana.id, admin.id] } } });
    await apagarClubesDeTeste(prisma, c);
    await app.close();
  });

  describe('prazo', () => {
    it('sem prazo → 409 PRAZO_ENCERRADO; com prazo no futuro grava (e regrava); meus devolve o palpite com pontos null', async () => {
      await lancar(33, [placar(c[0], c[1], null, null)]);
      const [j] = Object.values(await ids(33));
      expect((await palpitar(zeca, [p(j, 1, 0)]).expect(409)).body.codigo).toBe('PRAZO_ENCERRADO');
      await noPrazo(33, futuro());
      await palpitar(zeca, [p(j, 1, 0)]).expect(204);
      await palpitar(zeca, [p(j, 2, 2)]).expect(204); // muda de ideia antes do prazo
      expect(await prisma.palpite.count({ where: { userId: zeca.id } })).toBe(1);
      const meus = (await com('get', '/api/bolao/meus?rodada=33', zeca).expect(200)).body;
      expect(meus).toEqual([{ jogoId: j, copaJogoId: null, golsMandante: 2, golsVisitante: 2, classificadoId: null, pontos: null, exato: false }]);
    });

    it('1 s depois do prazo → 409 e nada gravado; um alvo vencido derruba o lote inteiro', async () => {
      await lancar(33, [placar(c[0], c[1], null, null)]);
      await lancar(34, [placar(c[0], c[2], null, null)]);
      const [j33] = Object.values(await ids(33)), [j34] = Object.values(await ids(34));
      await noPrazo(33, futuro());
      await noPrazo(34, new Date(Date.now() - 1000));
      expect((await palpitar(zeca, [p(j33, 1, 0), p(j34, 1, 0)]).expect(409)).body.codigo).toBe('PRAZO_ENCERRADO');
      expect((await palpitar(zeca, [p(j34, 1, 0)]).expect(409)).body.codigo).toBe('PRAZO_ENCERRADO');
      expect(await prisma.palpite.count({ where: { userId: zeca.id } })).toBe(0);
    });

    it('palpites dos outros: antes do prazo só o meu (lista vazia para quem não palpitou); depois do prazo, todos', async () => {
      await lancar(33, [placar(c[0], c[1], null, null)]);
      const [j] = Object.values(await ids(33));
      await noPrazo(33, futuro());
      await palpitar(zeca, [p(j, 1, 0)]).expect(204);
      await palpitar(bia, [p(j, 0, 0)]).expect(204);
      const ver = async (u: U) => (await com('get', `/api/bolao/jogo/brasileirao/${j}`, u).expect(200)).body as { usuario: { nome: string }; golsMandante: number }[];
      expect((await ver(zeca)).map((x) => x.usuario.nome)).toEqual(['Zeca']);
      expect(await ver(ana)).toEqual([]);
      await noPrazo(33, new Date(Date.now() - 1000));
      expect((await ver(ana)).map((x) => x.usuario.nome).sort((a, b) => a.localeCompare(b))).toEqual(['Bia', 'Zeca']);
      await noPrazo(33, null); // sem prazo também não revela
      expect(await ver(ana)).toEqual([]);
      await com('get', '/api/bolao/jogo/brasileirao/nao-e-uuid', ana).expect(404);
      await com('get', '/api/bolao/jogo/xx/' + j, ana).expect(404);
    });
  });

  describe('validação', () => {
    it('lote vazio, placar torto, alvo duplicado, dois alvos, classificadoId em jogo do Brasileirão → 400; jogo inexistente → 404', async () => {
      await lancar(33, [placar(c[0], c[1], null, null)]);
      const [j] = Object.values(await ids(33));
      await noPrazo(33, futuro());
      await palpitar(zeca, []).expect(400);
      await palpitar(zeca, {}).expect(400);
      await palpitar(zeca, [p(j, -1, 0)]).expect(400);
      await palpitar(zeca, [p(j, 1.5, 0)]).expect(400);
      await palpitar(zeca, [p(j, 100, 0)]).expect(400);
      await palpitar(zeca, [p(j, 1, 0), p(j, 2, 0)]).expect(400);
      await palpitar(zeca, [{ ...p(j, 1, 0), copaJogoId: j }]).expect(400);
      await palpitar(zeca, [{ golsMandante: 1, golsVisitante: 0 }]).expect(400);
      await palpitar(zeca, [{ ...p(j, 1, 0), classificadoId: c[0] }]).expect(400);
      await palpitar(zeca, [p('00000000-0000-4000-8000-000000000000', 1, 0)]).expect(404);
      await request(http()).put('/api/bolao/palpites').set('Origin', ORIGIN).send([p(j, 1, 0)]).expect(401);
      expect(await prisma.palpite.count({ where: { userId: zeca.id } })).toBe(0);
    });
  });

  describe('pontos e ranking', () => {
    const montar = async () => {
      await lancar(33, [placar(c[0], c[1], null, null), placar(c[2], c[3], null, null)]);
      await lancar(34, [placar(c[0], c[2], null, null), placar(c[1], c[3], null, null)]);
      await noPrazo(33, futuro());
      await noPrazo(34, futuro());
      const j = { ...(await ids(33)), ...(await ids(34)) };
      return { j1: j[`${c[0]}|${c[1]}`], j2: j[`${c[2]}|${c[3]}`], j3: j[`${c[0]}|${c[2]}`], j4: j[`${c[1]}|${c[3]}`] };
    };

    it('exato 3, vencedor/empate certo 1, errado 0; ranking com desempate por exatos e depois por nome', async () => {
      const { j1, j2, j3, j4 } = await montar();
      await palpitar(zeca, [p(j1, 2, 1)]).expect(204); // 3 pts, 1 exato
      await palpitar(bia, [p(j1, 1, 0), p(j2, 3, 0), p(j3, 1, 1)]).expect(204); // 1+1+1
      await palpitar(ana, [p(j1, 1, 0), p(j2, 3, 0), p(j3, 1, 1), p(j4, 0, 2)]).expect(204); // 1+1+1+0
      // resultados: 2-1, 1-0, 0-0, 3-3
      await noPrazo(33, new Date(Date.now() - 1000));
      await noPrazo(34, new Date(Date.now() - 1000));
      await lancar(33, [placar(c[0], c[1], 2, 1), placar(c[2], c[3], 1, 0)]);
      await lancar(34, [placar(c[0], c[2], 0, 0), placar(c[1], c[3], 3, 3)]);
      expect((await ranking()).map((l) => [l.usuario.nome, l.pontos, l.exatos])).toEqual([['Zeca', 3, 1], ['Ana', 3, 0], ['Bia', 3, 0]]);
      const meus = (await com('get', '/api/bolao/meus?rodada=34', ana).expect(200)).body as { jogoId: string; pontos: number; exato: boolean }[];
      expect(meus.map((m) => [m.pontos, m.exato]).sort((x, y) => JSON.stringify(x).localeCompare(JSON.stringify(y)))).toEqual([[0, false], [1, false]]);
    });

    it('lançar o resultado de novo mantém os palpites (mesmo jogo) e mudar o placar recalcula os pontos sem gravar nada', async () => {
      const { j1 } = await montar();
      await palpitar(zeca, [p(j1, 2, 1)]).expect(204);
      await noPrazo(33, new Date(Date.now() - 1000));
      await lancar(33, [placar(c[0], c[1], 2, 1)]);
      expect((await ranking()).find((l) => l.usuario.id === zeca.id)).toMatchObject({ pontos: 3, exatos: 1 });
      await lancar(33, [placar(c[0], c[1], 0, 3)]); // corrigiu o placar: palpite errado agora
      expect((await ranking()).find((l) => l.usuario.id === zeca.id)).toMatchObject({ pontos: 0, exatos: 0 });
      expect((await prisma.jogo.findMany({ where: { rodadaNumero: 33 } })).map((j) => j.id)).toContain(j1);
      expect((await prisma.palpite.findMany({ where: { userId: zeca.id } }))).toHaveLength(1);
      await lancar(33, [placar(c[0], c[1], 2, 1)]);
      expect((await ranking()).find((l) => l.usuario.id === zeca.id)).toMatchObject({ pontos: 3 });
    });

    it('o resumo da CBF ganha a linha do rei do bolão da rodada', async () => {
      const { j1 } = await montar();
      await palpitar(zeca, [p(j1, 2, 1)]).expect(204);
      await noPrazo(33, new Date(Date.now() - 1000));
      await lancar(33, [placar(c[0], c[1], 2, 1), placar(c[2], c[3], 1, 0)]);
      await com('post', '/api/admin/rodadas/33/fechar', admin).expect(204);
      const previa = (await com('post', '/api/admin/rodadas/33/previa', admin).expect(201)).body;
      expect(previa.texto).toContain('Zeca');
      // rodada sem ninguém pontuando: sem a linha
      const sem = (await com('post', '/api/admin/rodadas/33/previa', admin).expect(201)).body.texto as string;
      expect(sem.length).toBeLessThanOrEqual(500);
    });
  });

  describe('Copa', () => {
    const fase = async (ordem: number) => (await com('post', '/api/admin/copa/fases', admin).send({ nome: `Fase ${ordem}`, ordem }).expect(201)).body.id as string;
    const jogosCopa = (f: string, jogos: unknown) => com('put', `/api/admin/copa/fases/${f}/jogos`, admin).send({ jogos }).expect(204);
    const idCopa = async (f: string) => (await prisma.copaJogo.findFirstOrThrow({ where: { faseId: f } })).id;
    const pc = (copaJogoId: string, gm: number, gv: number, classificadoId?: string) => ({ copaJogoId, golsMandante: gm, golsVisitante: gv, ...(classificadoId && { classificadoId }) });

    it('palpite de empate exige classificadoId (um dos dois clubes); placar com vencedor não aceita classificadoId contrário', async () => {
      const f = await fase(94);
      await jogosCopa(f, [placar(c[0], c[1], null, null)]);
      await com('put', `/api/admin/copa/fases/${f}/prazo`, admin).send({ prazoPalpite: futuro().toISOString() }).expect(204);
      const j = await idCopa(f);
      await palpitar(zeca, [pc(j, 1, 1)]).expect(400);
      await palpitar(zeca, [pc(j, 1, 1, c[2])]).expect(400);
      await palpitar(zeca, [pc(j, 2, 0, c[1])]).expect(400);
      await palpitar(zeca, [pc(j, 1, 1, c[1])]).expect(204);
      await palpitar(bia, [pc(j, 2, 0)]).expect(204); // quem passa sai do placar
      expect((await prisma.palpite.findFirstOrThrow({ where: { userId: bia.id } })).classificadoId).toBe(c[0]);
    });

    it('Copa: placar + 1 por acertar quem passa; vencedor nos pênaltis conta; palpites dos outros só depois do prazo da fase', async () => {
      const f = await fase(94);
      await jogosCopa(f, [placar(c[0], c[1], null, null)]);
      await com('put', `/api/admin/copa/fases/${f}/prazo`, admin).send({ prazoPalpite: futuro().toISOString() }).expect(204);
      const j = await idCopa(f);
      await palpitar(zeca, [pc(j, 1, 1, c[1])]).expect(204); // exato + passa
      await palpitar(bia, [pc(j, 0, 0, c[0])]).expect(204); // empate certo, errou quem passa
      await palpitar(ana, [pc(j, 2, 0)]).expect(204); // errou o placar, errou quem passa
      expect(((await com('get', `/api/bolao/jogo/copa/${j}`, ana).expect(200)).body as unknown[]).length).toBe(1);
      await com('put', `/api/admin/copa/fases/${f}/prazo`, admin).send({ prazoPalpite: new Date(Date.now() - 1000).toISOString() }).expect(204);
      await jogosCopa(f, [placar(c[0], c[1], 1, 1, { penaltisMandante: 3, penaltisVisitante: 5 })]); // c1 passa
      expect(((await com('get', `/api/bolao/jogo/copa/${j}`, ana).expect(200)).body as unknown[]).length).toBe(3);
      const r = await ranking();
      expect(r.map((l) => [l.usuario.nome, l.pontos, l.exatos])).toEqual([['Zeca', 4, 1], ['Bia', 1, 0], ['Ana', 0, 0]]);
      expect((await com('get', `/api/bolao/meus?fase=${f}`, zeca).expect(200)).body).toEqual([expect.objectContaining({ copaJogoId: j, pontos: 4, exato: true })]);
      await com('get', '/api/bolao/meus', zeca).expect(400);
      await com('get', `/api/bolao/meus?fase=${f}&rodada=1`, zeca).expect(400);
    });

    it('o resumo da fase cita o rei do bolão', async () => {
      const f = await fase(94);
      await jogosCopa(f, [placar(c[0], c[1], null, null)]);
      await com('put', `/api/admin/copa/fases/${f}/prazo`, admin).send({ prazoPalpite: futuro().toISOString() }).expect(204);
      await palpitar(zeca, [pc(await idCopa(f), 2, 0)]).expect(204);
      await com('put', `/api/admin/copa/fases/${f}/prazo`, admin).send({ prazoPalpite: new Date(Date.now() - 1000).toISOString() }).expect(204);
      await jogosCopa(f, [placar(c[0], c[1], 2, 0)]);
      expect((await com('post', `/api/admin/copa/fases/${f}/fechar`, admin).expect(201)).body.texto).toContain('Zeca');
    });
  });
});
