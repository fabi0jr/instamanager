import type { INestApplication } from '@nestjs/common';
import { vi } from 'vitest';
import request from 'supertest';
import type { PrismaService } from '../src/prisma.service.js';
import { PushService } from '../src/push/push.service.js';
import { apagarClubesDeTeste, cadastrarUsuario, criarApp, criarClubesDeTeste, ORIGIN } from './helpers.js';

// Rodadas 35 e 36 e clubes teste-votacoes-N são só deste arquivo (os e2e rodam em paralelo no mesmo banco).
describe('bot da zoeira, votações e selos (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let post: Awaited<ReturnType<typeof criarApp>>['post'];
  let http: () => ReturnType<INestApplication['getHttpServer']>;
  type U = Awaited<ReturnType<typeof cadastrarUsuario>>;
  let admin: U, tecnico0: U, tecnico1: U, torcedor: U, outro: U;
  let c: string[];
  const usuarios: string[] = [];
  const com = (m: 'get' | 'put' | 'post' | 'delete', url: string, u: U) => request(http())[m](url).set('Origin', ORIGIN).set('Cookie', u.cookie);
  const jogo = (m: string, v: string, gm: number, gv: number) => ({ mandanteId: m, visitanteId: v, golsMandante: gm, golsVisitante: gv });
  const fechar = async (n: number, jogos: object[]) => {
    await com('put', `/api/admin/rodadas/${n}/jogos`, admin).send({ jogos }).expect(204);
    await com('post', `/api/admin/rodadas/${n}/fechar`, admin).expect(204);
  };
  const amanha = () => new Date(Date.now() + 86_400_000).toISOString();
  const criar = (corpo: object, u: U = admin) => com('post', '/api/admin/votacoes', u).send(corpo);
  const votar = (id: string, opcao: unknown, u: U) => com('post', `/api/votacoes/${id}/voto`, u).send({ opcao });
  const novaVotacao = async (extra: object = {}) => (await criar({ titulo: 'Melhor torcida', tipo: 'CLUBE', opcoes: [c[0], c[1], c[2]], prazo: amanha(), ...extra }).expect(201)).body;

  beforeAll(async () => {
    ({ app, prisma, post, http } = await criarApp());
    c = await criarClubesDeTeste(prisma, 'votacoes', 4);
    tecnico0 = await cadastrarUsuario(post, prisma, c[0], 'Técnico Zero');
    tecnico1 = await cadastrarUsuario(post, prisma, c[1], 'Técnico Um');
    torcedor = await cadastrarUsuario(post, prisma, null, 'Torcedor');
    outro = await cadastrarUsuario(post, prisma, null, 'Outro');
    admin = await cadastrarUsuario(post, prisma, null, 'Admin');
    usuarios.push(tecnico0.id, tecnico1.id, torcedor.id, outro.id, admin.id);
    await prisma.user.update({ where: { id: admin.id }, data: { isAdmin: true } });
  });
  afterEach(async () => {
    await prisma.jogo.deleteMany({ where: { rodadaNumero: { in: [35, 36] } } });
    await prisma.rodada.updateMany({ where: { numero: { in: [35, 36] } }, data: { fechadaEm: null } });
    await prisma.votacao.deleteMany({ where: { criadaPor: admin.id } });
    await prisma.post.deleteMany({ where: { authorId: { in: usuarios } } });
  });
  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: usuarios } } });
    await apagarClubesDeTeste(prisma, c);
    await app.close();
  });

  describe('prévia e publicação da rodada', () => {
    it('prévia de rodada aberta → 409 RODADA_ABERTA', async () => {
      expect((await com('post', '/api/admin/rodadas/35/previa', admin).expect(409)).body.codigo).toBe('RODADA_ABERTA');
      await com('post', '/api/admin/rodadas/99/previa', admin).expect(404);
    });

    it('prévia de rodada fechada traz texto (≤ 500) e cita o técnico do goleado', async () => {
      await fechar(35, [jogo(c[1], c[0], 5, 0), jogo(c[2], c[3], 1, 1)]);
      const r = (await com('post', '/api/admin/rodadas/35/previa', admin).expect(201)).body;
      expect(r.texto.length).toBeLessThanOrEqual(500);
      expect(r.texto.split('\n').length).toBeGreaterThanOrEqual(3);
      expect(r.texto).toContain('Teste votacoes 1'); // c0 tomou 5 a 0
      expect(r.texto).toContain('Técnico Zero');
      expect(r.citados).toContain(tecnico0.id);
    });

    it('previa e publicar: não-admin → 403', async () => {
      await com('post', '/api/admin/rodadas/35/previa', tecnico0).expect(403);
      await com('post', '/api/admin/rodadas/35/publicar', torcedor).send({ texto: 'oi' }).expect(403);
    });

    it('publicar cria o post de texto da CBF; validações: vazio, > 500, rodada aberta', async () => {
      await com('post', '/api/admin/rodadas/35/publicar', admin).send({ texto: 'Resumo' }).expect(409); // aberta
      await fechar(35, [jogo(c[1], c[0], 5, 0)]);
      await com('post', '/api/admin/rodadas/35/publicar', admin).send({ texto: '   ' }).expect(400);
      await com('post', '/api/admin/rodadas/35/publicar', admin).send({ texto: 'x'.repeat(501) }).expect(400);
      const p = (await com('post', '/api/admin/rodadas/35/publicar', admin).send({ texto: `Fim da rodada 35\nTécnico Zero apanhou` }).expect(201)).body;
      expect(p).toMatchObject({ clube: { id: 'cbf' }, texto: 'Fim da rodada 35\nTécnico Zero apanhou', imagens: [] });
      expect((await com('get', `/api/posts/${p.id}`, torcedor).expect(200)).body.clube.id).toBe('cbf');
    });
  });

  describe('push da publicação da rodada', () => {
    const esperar = () => new Promise((r) => setTimeout(r, 300)); // os listeners de push rodam soltos
    const espiar = () => vi.spyOn(app.get(PushService), 'enviar').mockResolvedValue();
    const publicar = (n: number, corpo: object) => com('post', `/api/admin/rodadas/${n}/publicar`, admin).send(corpo);

    it('push geral sai como CBF, sem o nome do admin e sem os citados; citado recebe só "A CBF citou você"', async () => {
      await fechar(35, [jogo(c[1], c[0], 5, 0), jogo(c[2], c[3], 1, 1)]);
      const espia = espiar();
      const p = (await publicar(35, { texto: 'Fim da rodada\nTécnico Zero tomou 5 a 0', citados: [tecnico0.id] }).expect(201)).body;
      await esperar();
      const chamadas = espia.mock.calls.filter(([, m]) => m.url === `/p/${p.id}`);
      const geral = chamadas.find(([, m]) => m.titulo === 'CBF')!;
      expect(geral[1]).toEqual({ titulo: 'CBF', corpo: 'Saiu o resumo da rodada 35', url: `/p/${p.id}` });
      expect(geral[0]).not.toContain(tecnico0.id);
      expect(geral[0]).not.toContain(admin.id);
      expect(geral[0]).toEqual(expect.arrayContaining([tecnico1.id, torcedor.id]));
      const citou = chamadas.filter(([, m]) => m.titulo === 'A CBF citou você');
      expect(citou.map(([ids]) => ids)).toEqual([[tecnico0.id]]);
      // ninguém recebe o push genérico "<nome> postou" desse post
      expect(chamadas.some(([, m]) => m.corpo.includes('postou') || m.corpo.includes('Admin'))).toBe(false);
      espia.mockRestore();
    });

    it('citado que o admin tirou do texto não é avisado (palavra inteira); id fora da rodada é ignorado', async () => {
      await fechar(35, [jogo(c[1], c[0], 5, 0)]);
      const espia = espiar();
      // "Técnico Zeroni" não conta como "Técnico Zero"; tecnico1 é de clube que jogou mas não está no texto; torcedor não é técnico da rodada
      const p = (await publicar(35, { texto: 'Rodada boa para o Técnico Zeroni', citados: [tecnico0.id, tecnico1.id, torcedor.id, 'lixo', 7] }).expect(201)).body;
      await esperar();
      const chamadas = espia.mock.calls.filter(([, m]) => m.url === `/p/${p.id}`);
      expect(chamadas.filter(([, m]) => m.titulo === 'A CBF citou você')).toEqual([]);
      expect(chamadas.find(([, m]) => m.titulo === 'CBF')![0]).toEqual(expect.arrayContaining([tecnico0.id, tecnico1.id, torcedor.id]));
      espia.mockRestore();
    });

    it('sem o campo citados ninguém é citado; citados que não é lista → 400', async () => {
      await fechar(35, [jogo(c[1], c[0], 5, 0)]);
      const espia = espiar();
      const p = (await publicar(35, { texto: 'Técnico Zero apareceu' }).expect(201)).body;
      await esperar();
      expect(espia.mock.calls.some(([, m]) => m.url === `/p/${p.id}` && m.titulo === 'A CBF citou você')).toBe(false);
      await publicar(35, { texto: 'x', citados: 'u1' }).expect(400);
      espia.mockRestore();
    });
  });

  describe('votações', () => {
    it('só admin cria; valida título, tipo, opções, prazo', async () => {
      await criar({ titulo: 'x', tipo: 'CLUBE', opcoes: [c[0], c[1]], prazo: amanha() }, tecnico0).expect(403);
      const ok = { titulo: 'Melhor torcida', tipo: 'CLUBE', opcoes: [c[0], c[1]], prazo: amanha() };
      for (const ruim of [
        { titulo: '' }, { titulo: 'x'.repeat(101) }, { tipo: 'OUTRO' }, { opcoes: [c[0]] }, { opcoes: [c[0], c[0]] }, { opcoes: [c[0], 'nao-existe'] },
        { opcoes: [c[0], 'cbf'] }, { prazo: 'ontem' }, { prazo: new Date(Date.now() - 1000).toISOString() }, { prazo: undefined }, { opcoes: 'x' },
      ])
        expect((await criar({ ...ok, ...ruim }).expect(400)).body.codigo, JSON.stringify(ruim)).toBe('DADOS_INVALIDOS');
      expect(await prisma.votacao.count({ where: { criadaPor: admin.id } })).toBe(0);
      const v = (await criar(ok).expect(201)).body;
      expect(v).toMatchObject({ titulo: 'Melhor torcida', tipo: 'CLUBE', aberta: true, encerrada: false, meuVoto: null, opcoes: [{ id: c[0], rotulo: 'Teste votacoes 1' }, { id: c[1] }] });
      expect(v.resultado).toBeUndefined();
    });

    it('tipos TECNICO e POST validam as opções (usuário sem clube e post inexistente → 400)', async () => {
      await criar({ titulo: 'Técnico do mês', tipo: 'TECNICO', opcoes: [tecnico0.id, torcedor.id], prazo: amanha() }).expect(400);
      await criar({ titulo: 'Técnico do mês', tipo: 'TECNICO', opcoes: [tecnico0.id, tecnico1.id], prazo: amanha() }).expect(201);
      await criar({ titulo: 'Post do mês', tipo: 'POST', opcoes: ['00000000-0000-4000-8000-000000000000', 'abc'], prazo: amanha() }).expect(400);
    });

    it('GET /votacoes lista as não encerradas com meuVoto; votar 2x → 409 JA_VOTOU; opção inválida → 400', async () => {
      const v = await novaVotacao();
      await votar(v.id, c[1], torcedor).expect(204);
      expect((await votar(v.id, c[2], torcedor).expect(409)).body.codigo).toBe('JA_VOTOU');
      expect((await votar(v.id, 'nao-e-opcao', outro).expect(400)).body.codigo).toBe('DADOS_INVALIDOS');
      await votar(v.id, undefined, outro).expect(400);
      await votar('00000000-0000-4000-8000-000000000000', c[0], outro).expect(404);
      const lista = (await com('get', '/api/votacoes', torcedor).expect(200)).body;
      expect(lista.find((x: { id: string }) => x.id === v.id)).toMatchObject({ meuVoto: c[1], aberta: true });
      expect((await com('get', '/api/votacoes', outro).expect(200)).body.find((x: { id: string }) => x.id === v.id).meuVoto).toBeNull();
      expect(await prisma.voto.count({ where: { votacaoId: v.id } })).toBe(1);
    });

    it('votar depois do prazo → 409 VOTACAO_ENCERRADA, e nada é gravado', async () => {
      const v = await prisma.votacao.create({ data: { titulo: 'Velha', tipo: 'CLUBE', opcoes: [c[0], c[1]], prazo: new Date(Date.now() - 60_000), criadaPor: admin.id } });
      expect((await votar(v.id, c[0], torcedor).expect(409)).body.codigo).toBe('VOTACAO_ENCERRADA');
      expect(await prisma.voto.count({ where: { votacaoId: v.id } })).toBe(0);
      const visto = (await com('get', `/api/votacoes/${v.id}`, torcedor).expect(200)).body;
      expect(visto).toMatchObject({ aberta: false, encerrada: false });
      expect(visto.resultado).toBeUndefined();
    });

    it('resultado antes de encerrar não vem (nem na lista nem no detalhe), nem para o admin', async () => {
      const v = await novaVotacao();
      await votar(v.id, c[0], torcedor).expect(204);
      await votar(v.id, c[0], outro).expect(204);
      for (const u of [torcedor, admin]) {
        const d = (await com('get', `/api/votacoes/${v.id}`, u).expect(200)).body;
        expect(d.resultado).toBeUndefined();
        expect(JSON.stringify(d)).not.toMatch(/votos/);
      }
      const l = (await com('get', '/api/votacoes', admin).expect(200)).body.find((x: { id: string }) => x.id === v.id);
      expect(l.resultado).toBeUndefined();
    });

    it('encerrar: não-admin → 403; cria selo para o vencedor e o post da CBF; depois o resultado aparece; 2x → 409', async () => {
      const v = await novaVotacao();
      await votar(v.id, c[1], torcedor).expect(204);
      await votar(v.id, c[1], outro).expect(204);
      await votar(v.id, c[0], tecnico0).expect(204);
      await com('post', `/api/admin/votacoes/${v.id}/encerrar`, tecnico1).expect(403);

      const r = (await com('post', `/api/admin/votacoes/${v.id}/encerrar`, admin).expect(201)).body;
      expect(r).toMatchObject({ encerrada: true, aberta: false, resultado: [{ opcao: c[1], votos: 2 }, { opcao: c[0], votos: 1 }, { opcao: c[2], votos: 0 }] });

      expect(await prisma.selo.findMany({ where: { votacaoId: v.id } })).toMatchObject([{ clubId: c[1], titulo: 'Melhor torcida' }]);
      const perfil = (await com('get', `/api/clubes/${c[1]}`, torcedor).expect(200)).body;
      expect(perfil.selos).toEqual([{ titulo: 'Melhor torcida', createdAt: expect.any(String) }]);
      expect((await com('get', `/api/clubes/${c[0]}`, torcedor).expect(200)).body.selos).toEqual([]);

      const cbf = await prisma.post.findMany({ where: { clubId: 'cbf', authorId: admin.id } });
      expect(cbf).toHaveLength(1);
      expect(cbf[0].texto).toContain('Melhor torcida');
      expect(cbf[0].texto).toContain('Teste votacoes 2'); // o vencedor
      expect(cbf[0].texto!.length).toBeLessThanOrEqual(500);

      expect((await com('get', `/api/votacoes/${v.id}`, torcedor).expect(200)).body.resultado).toHaveLength(3);
      expect((await com('get', '/api/votacoes', torcedor).expect(200)).body.map((x: { id: string }) => x.id)).not.toContain(v.id);
      expect((await com('post', `/api/admin/votacoes/${v.id}/encerrar`, admin).expect(409)).body.codigo).toBe('VOTACAO_ENCERRADA');
      expect((await votar(v.id, c[0], admin).expect(409)).body.codigo).toBe('VOTACAO_ENCERRADA');
      expect(await prisma.selo.count({ where: { votacaoId: v.id } })).toBe(1);
    });

    it('empate dá selo a todos os empatados; sem votos não dá selo (mas o post sai)', async () => {
      const v = await novaVotacao({ titulo: 'Empate' });
      await votar(v.id, c[0], torcedor).expect(204);
      await votar(v.id, c[2], outro).expect(204);
      await com('post', `/api/admin/votacoes/${v.id}/encerrar`, admin).expect(201);
      expect((await prisma.selo.findMany({ where: { votacaoId: v.id } })).map((s) => s.clubId).sort()).toEqual([c[0], c[2]]);

      const vazio = await novaVotacao({ titulo: 'Ninguém quis' });
      await com('post', `/api/admin/votacoes/${vazio.id}/encerrar`, admin).expect(201);
      expect(await prisma.selo.count({ where: { votacaoId: vazio.id } })).toBe(0);
      expect(await prisma.post.count({ where: { clubId: 'cbf', authorId: admin.id, texto: { contains: 'Ninguém quis' } } })).toBe(1);
    });

    it('post ocultado depois de entrar na votação não vaza a legenda e não ganha selo', async () => {
      const p0 = await prisma.post.create({ data: { clubId: c[0], authorId: tecnico0.id, caption: 'Legenda secreta' } });
      const p1 = await prisma.post.create({ data: { clubId: c[1], authorId: tecnico1.id, caption: 'Outra' } });
      const v = (await criar({ titulo: 'Post oculto', tipo: 'POST', opcoes: [p0.id, p1.id], prazo: amanha() }).expect(201)).body;
      await votar(v.id, p0.id, torcedor).expect(204);
      await com('put', `/api/admin/posts/${p0.id}/ocultar`, admin).expect(204);
      const d = (await com('get', `/api/votacoes/${v.id}`, torcedor).expect(200)).body;
      expect(JSON.stringify(d)).not.toContain('Legenda secreta');
      expect(d.opcoes[0]).toEqual({ id: p0.id, rotulo: 'Post indisponível' });
      const r = (await com('post', `/api/admin/votacoes/${v.id}/encerrar`, admin).expect(201)).body;
      expect(JSON.stringify(r)).not.toContain('Legenda secreta');
      expect(await prisma.selo.count({ where: { votacaoId: v.id } })).toBe(0);
      expect(await prisma.post.count({ where: { texto: { contains: 'Legenda secreta' } } })).toBe(0);
    });

    it('TECNICO dá o selo ao clube do técnico; POST dá ao clube do post; rótulos legíveis', async () => {
      const t = (await criar({ titulo: 'Técnico do mês', tipo: 'TECNICO', opcoes: [tecnico0.id, tecnico1.id], prazo: amanha() }).expect(201)).body;
      expect(t.opcoes).toEqual([{ id: tecnico0.id, rotulo: 'Técnico Zero' }, { id: tecnico1.id, rotulo: 'Técnico Um' }]);
      await votar(t.id, tecnico1.id, torcedor).expect(204);
      await com('post', `/api/admin/votacoes/${t.id}/encerrar`, admin).expect(201);
      expect((await prisma.selo.findMany({ where: { votacaoId: t.id } })).map((s) => s.clubId)).toEqual([c[1]]);

      const p0 = await prisma.post.create({ data: { clubId: c[0], authorId: tecnico0.id, caption: 'Golaço de falta' } });
      const p1 = await prisma.post.create({ data: { clubId: c[1], authorId: tecnico1.id, caption: 'Arte nova' } });
      const pv = (await criar({ titulo: 'Post do mês', tipo: 'POST', opcoes: [p0.id, p1.id], prazo: amanha() }).expect(201)).body;
      expect(pv.opcoes[0]).toEqual({ id: p0.id, rotulo: 'Golaço de falta' });
      await votar(pv.id, p0.id, outro).expect(204);
      await com('post', `/api/admin/votacoes/${pv.id}/encerrar`, admin).expect(201);
      expect((await prisma.selo.findMany({ where: { votacaoId: pv.id } })).map((s) => s.clubId)).toEqual([c[0]]);
    });
  });
});
