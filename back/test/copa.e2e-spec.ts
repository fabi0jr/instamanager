import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { PrismaService } from '../src/prisma.service.js';
import { apagarClubesDeTeste, cadastrarUsuario, criarApp, criarClubesDeTeste, ORIGIN } from './helpers.js';

// Fases da Copa e clubes teste-copa-N são só deste arquivo (ordens 91–93, apagadas no afterEach).
describe('Copa do Brasil: fases, mata-mata e resumo (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let http: () => ReturnType<INestApplication['getHttpServer']>;
  type U = Awaited<ReturnType<typeof cadastrarUsuario>>;
  let admin: U, tecnico: U, torcedor: U;
  let c: string[];
  const usuarios: string[] = [];
  const com = (m: 'get' | 'put' | 'post', url: string, u: U) => request(http())[m](url).set('Origin', ORIGIN).set('Cookie', u.cookie);
  type P = Partial<Record<'golsMandante' | 'golsVisitante' | 'penaltisMandante' | 'penaltisVisitante', number | null>>;
  const jogo = (m: string, v: string, gm: number | null = null, gv: number | null = null, extra: P = {}) => ({ mandanteId: m, visitanteId: v, golsMandante: gm, golsVisitante: gv, ...extra });
  const fase = async (ordem: number, nome = `Fase ${ordem}`) => (await com('post', '/api/admin/copa/fases', admin).send({ nome, ordem }).expect(201)).body.id as string;
  const jogos = (id: string, lista: unknown, u: U = admin) => com('put', `/api/admin/copa/fases/${id}/jogos`, u).send({ jogos: lista });
  const chave = async () => ((await com('get', '/api/copa', torcedor).expect(200)).body as { fase: { id: string }; jogos: { vencedor: { id: string } | null }[] }[]);

  beforeAll(async () => {
    const a = await criarApp();
    ({ app, prisma, http } = a);
    c = await criarClubesDeTeste(prisma, 'copa', 4);
    tecnico = await cadastrarUsuario(a.post, prisma, c[0], 'Técnico Copa');
    torcedor = await cadastrarUsuario(a.post, prisma, null, 'Torcedor');
    admin = await cadastrarUsuario(a.post, prisma, null, 'Admin');
    usuarios.push(tecnico.id, torcedor.id, admin.id);
    await prisma.user.update({ where: { id: admin.id }, data: { isAdmin: true } });
    await prisma.copaFase.deleteMany({ where: { ordem: { gte: 91 } } });
  });
  afterEach(async () => {
    await prisma.post.deleteMany({ where: { authorId: admin.id } });
    await prisma.copaFase.deleteMany({ where: { ordem: { gte: 91 } } });
  });
  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: usuarios } } });
    await apagarClubesDeTeste(prisma, c);
    await app.close();
  });

  it('só admin cria fase; ordem repetida → 409; nome/ordem inválidos → 400', async () => {
    await com('post', '/api/admin/copa/fases', torcedor).send({ nome: 'X', ordem: 91 }).expect(403);
    await fase(91);
    expect((await com('post', '/api/admin/copa/fases', admin).send({ nome: 'Outra', ordem: 91 }).expect(409)).body.codigo).toBe('ORDEM_REPETIDA');
    await com('post', '/api/admin/copa/fases', admin).send({ nome: '', ordem: 92 }).expect(400);
    await com('post', '/api/admin/copa/fases', admin).send({ nome: 'X', ordem: 0 }).expect(400);
  });

  it('GET /copa: fases por ordem com jogos e vencedor (placar, ou pênaltis no empate); agendado sem vencedor', async () => {
    const f2 = await fase(92), f1 = await fase(91);
    await jogos(f1, [jogo(c[0], c[1], 2, 1), jogo(c[2], c[3], 1, 1, { penaltisMandante: 3, penaltisVisitante: 4 })]).expect(204);
    await jogos(f2, [jogo(c[0], c[3])]).expect(204);
    const k = (await chave()).filter((x) => [f1, f2].includes(x.fase.id));
    expect(k.map((x) => x.fase.id)).toEqual([f1, f2]);
    expect(k[0].fase).toMatchObject({ nome: 'Fase 91', ordem: 91, prazoPalpite: null, fechada: false, resumoPublicado: false, resumoPostId: null });
    expect(k[0].jogos.map((j) => j.vencedor?.id).sort((x, y) => String(x).localeCompare(String(y)))).toEqual([c[0], c[3]].sort());
    expect(k[0].jogos.find((j) => (j as unknown as { mandante: { id: string } }).mandante.id === c[2])).toMatchObject({ mandante: { nome: expect.any(String), escudoUrl: expect.any(String) }, golsMandante: 1, penaltisMandante: 3, penaltisVisitante: 4, vencedor: { id: c[3] } });
    expect(k[1].jogos[0].vencedor).toBeNull();
  });

  it('empate sem pênaltis, pênaltis empatados, pênaltis sem empate ou placar torto → 400 e nada gravado', async () => {
    const f = await fase(91);
    await jogos(f, [jogo(c[0], c[1], 1, 1)]).expect(400);
    await jogos(f, [jogo(c[0], c[1], 1, 1, { penaltisMandante: 4, penaltisVisitante: 4 })]).expect(400);
    await jogos(f, [jogo(c[0], c[1], 1, 1, { penaltisMandante: 100, penaltisVisitante: 4 })]).expect(400);
    await jogos(f, [jogo(c[0], c[1], 2, 1, { penaltisMandante: 4, penaltisVisitante: 3 })]).expect(400);
    await jogos(f, [jogo(c[0], c[1], null, null, { penaltisMandante: 4, penaltisVisitante: 3 })]).expect(400);
    await jogos(f, [jogo(c[0], c[1], 1, null)]).expect(400);
    await jogos(f, [jogo(c[0], c[1], -1, 0)]).expect(400);
    expect(await prisma.copaJogo.count({ where: { faseId: f } })).toBe(0);
  });

  it('a CBF fora, clube inexistente, clube duas vezes na fase, contra si mesmo → 400', async () => {
    const f = await fase(91);
    await jogos(f, [jogo(c[0], 'cbf')]).expect(400);
    await jogos(f, [jogo(c[0], 'nao-existe')]).expect(400);
    await jogos(f, [jogo(c[0], c[1]), jogo(c[2], c[0])]).expect(400);
    await jogos(f, [jogo(c[0], c[1]), jogo(c[0], c[1])]).expect(400);
    await jogos(f, [jogo(c[0], c[0])]).expect(400);
    await com('put', `/api/admin/copa/fases/${f}/jogos`, admin).send({ jogos: 'x' }).expect(400);
    await jogos('nao-e-uuid', []).expect(404);
    await jogos(f, [], torcedor).expect(403);
  });

  it('CLUBE_ELIMINADO: quem perdeu (inclusive nos pênaltis) não entra em fase de ordem maior; quem passou, sim', async () => {
    const f1 = await fase(91), f2 = await fase(92);
    await jogos(f1, [jogo(c[0], c[1], 1, 0), jogo(c[2], c[3], 2, 2, { penaltisMandante: 3, penaltisVisitante: 5 })]).expect(204); // caem c1 e c2
    expect((await jogos(f2, [jogo(c[0], c[2])]).expect(409)).body.codigo).toBe('CLUBE_ELIMINADO');
    expect((await jogos(f2, [jogo(c[1], c[3])]).expect(409)).body.codigo).toBe('CLUBE_ELIMINADO');
    expect(await prisma.copaJogo.count({ where: { faseId: f2 } })).toBe(0);
    await jogos(f2, [jogo(c[0], c[3])]).expect(204);
  });

  it('CLUBE_ELIMINADO também ao mudar o placar de uma fase anterior que eliminaria quem já joga adiante', async () => {
    const f1 = await fase(91), f2 = await fase(92);
    await jogos(f1, [jogo(c[0], c[1], 0, 1)]).expect(204); // c1 passa
    await jogos(f2, [jogo(c[1], c[2])]).expect(204);
    expect((await jogos(f1, [jogo(c[0], c[1], 1, 0)]).expect(409)).body.codigo).toBe('CLUBE_ELIMINADO'); // agora c1 cairia
    expect((await chave()).find((x) => x.fase.id === f1)!.jogos[0].vencedor!.id).toBe(c[1]); // nada mudou
  });

  it('fechar exige todos os placares (e ao menos um jogo): PLACAR_PENDENTE; fechada não aceita jogos nem fechar de novo (409)', async () => {
    const f = await fase(91);
    expect((await com('post', `/api/admin/copa/fases/${f}/fechar`, admin).expect(409)).body.codigo).toBe('PLACAR_PENDENTE'); // sem jogos
    await jogos(f, [jogo(c[0], c[1], 1, 0), jogo(c[2], c[3])]).expect(204);
    expect((await com('post', `/api/admin/copa/fases/${f}/fechar`, admin).expect(409)).body.codigo).toBe('PLACAR_PENDENTE');
    await jogos(f, [jogo(c[0], c[1], 1, 0), jogo(c[2], c[3], 0, 3)]).expect(204);
    const previa = (await com('post', `/api/admin/copa/fases/${f}/fechar`, admin).expect(201)).body;
    expect(previa.texto).toMatch(/\n/);
    expect(previa.texto.length).toBeLessThanOrEqual(500);
    expect(previa.citados).toEqual(expect.any(Array));
    expect((await jogos(f, [jogo(c[0], c[1], 5, 0)]).expect(409)).body.codigo).toBe('FASE_FECHADA');
    expect((await com('post', `/api/admin/copa/fases/${f}/fechar`, admin).expect(409)).body.codigo).toBe('FASE_FECHADA');
    await com('post', `/api/admin/copa/fases/${f}/reabrir`, admin).expect(204);
    expect((await com('post', `/api/admin/copa/fases/${f}/reabrir`, admin).expect(409)).body.codigo).toBe('FASE_ABERTA');
    await jogos(f, [jogo(c[0], c[1], 5, 0)]).expect(204);
  });

  it('prévia cita o técnico de quem caiu; publicar cria o post da CBF, um por fase (409 no segundo); fase aberta → 409', async () => {
    const f = await fase(91, 'Oitavas');
    await jogos(f, [jogo(c[1], c[0], 2, 0), jogo(c[2], c[3], 1, 1, { penaltisMandante: 4, penaltisVisitante: 2 })]).expect(204); // c0 (com técnico) cai
    expect((await com('post', `/api/admin/copa/fases/${f}/publicar`, admin).send({ texto: 'oi' }).expect(409)).body.codigo).toBe('FASE_ABERTA');
    let previa = { texto: '', citados: [] as string[] };
    for (let i = 0; i < 40; i++) {
      previa = (await com('post', `/api/admin/copa/fases/${f}/fechar`, admin).expect(201)).body; // sorteia de novo a cada fechada
      if (previa.citados.includes(tecnico.id)) break;
      await com('post', `/api/admin/copa/fases/${f}/reabrir`, admin).expect(204);
    }
    expect(previa.citados).toContain(tecnico.id);
    expect(previa.texto).toContain('Técnico Copa');
    const post = (await com('post', `/api/admin/copa/fases/${f}/publicar`, admin).send({ texto: previa.texto, citados: previa.citados }).expect(201)).body;
    expect(post).toMatchObject({ id: expect.any(String) });
    expect((await chave()).length).toBeGreaterThan(0);
    expect((await com('post', `/api/admin/copa/fases/${f}/publicar`, admin).send({ texto: previa.texto }).expect(409)).body.codigo).toBe('RESUMO_JA_PUBLICADO');
    const k = (await chave()).find((x) => x.fase.id === f)!;
    expect(k.fase).toMatchObject({ fechada: true, resumoPublicado: true, resumoPostId: post.id });
    await com('post', `/api/admin/copa/fases/${f}/publicar`, torcedor).send({ texto: 'x' }).expect(403);
  });

  it('prazo da fase: grava, aparece em /copa, null tira, inválido → 400, fase inexistente → 404', async () => {
    const f = await fase(91);
    const prazo = '2026-12-10T22:00:00.000Z';
    await com('put', `/api/admin/copa/fases/${f}/prazo`, admin).send({ prazoPalpite: prazo }).expect(204);
    expect((await chave()).find((x) => x.fase.id === f)!.fase).toMatchObject({ prazoPalpite: prazo });
    await com('put', `/api/admin/copa/fases/${f}/prazo`, admin).send({ prazoPalpite: null }).expect(204);
    await com('put', `/api/admin/copa/fases/${f}/prazo`, admin).send({ prazoPalpite: 'x' }).expect(400);
    await com('put', `/api/admin/copa/fases/00000000-0000-4000-8000-000000000000/prazo`, admin).send({ prazoPalpite: prazo }).expect(404);
  });

  it('GET /liga/calendario inclui jogo da Copa sem placar de fase aberta, com a fase', async () => {
    const f = await fase(91, 'Final');
    await jogos(f, [jogo(c[0], c[1])]).expect(204);
    const itens = (await com('get', '/api/liga/calendario', torcedor).expect(200)).body as { tipo: string; fase: { id: string; nome: string } | null; rodada: number | null; mandante: { id: string } }[];
    expect(itens.find((i) => i.mandante.id === c[0])).toMatchObject({ tipo: 'COPA', rodada: null, fase: { id: f, nome: 'Final' } });
  });
});
