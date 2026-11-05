import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { CleanupService } from '../src/auth/cleanup.service.js';
import type { PrismaService } from '../src/prisma.service.js';
import { arquivosEm, gerarAmostras } from './amostras.js';
import { apagarClubesDeTeste, cadastrarUsuario, criarApp, criarClubesDeTeste, ORIGIN } from './helpers.js';
import { montarJpeg } from './jpeg.js';

// Clubes teste-stories-N são só deste arquivo.
type U = { id: string; cookie: string[] };
type Item = { id: string; tipo: string; url: string | null; capaUrl: string | null; criadoEm: string; visto: boolean; texto: string | null; fundo: string | null };
type Faixa = { clube: { id: string; nome: string; escudoUrl: string }; stories: Item[]; todosVistos: boolean };

describe('stories (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let post: Awaited<ReturnType<typeof criarApp>>['post'];
  let http: () => ReturnType<INestApplication['getHttpServer']>;
  let dir: string;
  let c: string[];
  let tecnico0: U, tecnico1: U, torcedor: U, admin: U;
  const usuarios: string[] = [];
  const amostras = gerarAmostras();
  const com = (m: 'get' | 'put' | 'delete', url: string, u: U) => request(http())[m](url).set('Origin', ORIGIN).set('Cookie', u.cookie);
  const enviar = (u: U) => request(http()).post('/api/stories').set('Origin', ORIGIN).set('Cookie', u.cookie);
  const foto = (u: U) => enviar(u).attach('imagem', montarJpeg(720, 1280), 's.jpg');
  const lista = async (u: U) => (await com('get', '/api/stories', u).expect(200)).body as Faixa[];
  const meusStories = (u: U) => lista(u).then((l) => l.flatMap((f) => f.stories).filter((s) => ids.includes(s.id)));
  let ids: string[] = [];
  const guardar = async (r: request.Test) => {
    const res = await r;
    if (res.body?.id) ids.push(res.body.id);
    return res;
  };

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'im-stories-'));
    vi.stubEnv('UPLOADS_DIR', dir);
    ({ app, prisma, post, http } = await criarApp());
    c = await criarClubesDeTeste(prisma, 'stories', 2);
    tecnico0 = await cadastrarUsuario(post, prisma, c[0], 'Técnico Story Zero');
    tecnico1 = await cadastrarUsuario(post, prisma, c[1], 'Técnico Story Um');
    torcedor = await cadastrarUsuario(post, prisma, null, 'Torcedor Story');
    admin = await cadastrarUsuario(post, prisma, null, 'Admin Story');
    usuarios.push(tecnico0.id, tecnico1.id, torcedor.id, admin.id);
    await prisma.user.update({ where: { id: admin.id }, data: { isAdmin: true } });
  });
  afterEach(async () => {
    ids = [];
    await prisma.story.deleteMany({ where: { autorId: { in: usuarios } } });
    await rm(dir, { recursive: true, force: true });
  });
  afterAll(async () => {
    vi.unstubAllEnvs();
    amostras.limpar();
    await prisma.story.deleteMany({ where: { autorId: { in: usuarios } } });
    await new Promise((r) => setTimeout(r, 300)); // o primeiro story gera conquista: o post da CBF (do admin) sai solto, depois da resposta
    await prisma.post.deleteMany({ where: { authorId: { in: usuarios } } });
    await prisma.user.deleteMany({ where: { id: { in: usuarios } } });
    await apagarClubesDeTeste(prisma, c);
    await rm(dir, { recursive: true, force: true });
    await app.close();
  });

  it('story de imagem: 201 e aparece no GET como bolinha do clube', async () => {
    const r = await guardar(foto(tecnico0));
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ tipo: 'IMAGEM', url: expect.stringMatching(/^\/uploads\/stories\/[0-9a-f]{32}\.jpg$/), capaUrl: null, visto: false, clube: { id: c[0] }, expiraEm: expect.any(String) });
    const exp = new Date(r.body.expiraEm).getTime() - new Date(r.body.criadoEm).getTime();
    expect(Math.abs(exp - 24 * 3_600_000)).toBeLessThan(5_000);
    const faixa = (await lista(torcedor)).find((f) => f.clube.id === c[0])!;
    expect(faixa).toMatchObject({ todosVistos: false, clube: { id: c[0], nome: 'Teste stories 1', escudoUrl: '/escudos/generico.svg' } });
    expect(faixa.stories).toEqual([{ id: r.body.id, tipo: 'IMAGEM', url: r.body.url, capaUrl: null, criadoEm: r.body.criadoEm, visto: false, texto: null, fundo: null }]);
    expect(existsSync(join(dir, r.body.url.replace('/uploads/', '')))).toBe(true);
  });

  it('story de vídeo (HEVC/MOV do iPhone): vira mp4 com capa e o original não fica no disco', async () => {
    const r = await guardar(enviar(tecnico0).attach('video', amostras.hevcMov, 'iphone.mov'));
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ tipo: 'VIDEO', url: expect.stringMatching(/\.mp4$/), capaUrl: expect.stringMatching(/\.jpg$/) });
    expect(arquivosEm(dir).map((f) => f.replace(dir, '')).sort()).toEqual([r.body.capaUrl.replace('/uploads', ''), r.body.url.replace('/uploads', '')].sort());
  });

  it('vídeo de 31 s → 400 VIDEO_LONGO; texto renomeado .mp4 → 422 VIDEO_INVALIDO; 61 MB → 413; nada fica no disco', async () => {
    expect((await enviar(tecnico0).attach('video', amostras.longo, 'longo.mp4').expect(400)).body.codigo).toBe('VIDEO_LONGO');
    expect((await enviar(tecnico0).attach('video', amostras.texto, 'falso.mp4').expect(422)).body.codigo).toBe('VIDEO_INVALIDO');
    await enviar(tecnico0).attach('video', amostras.grande, 'grande.mp4').expect(413);
    expect(arquivosEm(dir)).toEqual([]);
    expect(await prisma.story.count({ where: { autorId: tecnico0.id } })).toBe(0);
  });

  it('imagem inválida (PNG) → 400 IMAGEM_INVALIDA; imagem > 3 MB → 413; nenhum ou os dois arquivos → 400', async () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect((await enviar(tecnico0).attach('imagem', png, 's.png').expect(400)).body.codigo).toBe('IMAGEM_INVALIDA');
    await enviar(tecnico0).attach('imagem', Buffer.concat([montarJpeg(10, 10), Buffer.alloc(4 * 1024 * 1024)]), 's.jpg').expect(413);
    await enviar(tecnico0).expect(400);
    await enviar(tecnico0).attach('imagem', montarJpeg(10, 10), 's.jpg').attach('video', amostras.hevcMov, 'v.mov').expect(400);
    expect(arquivosEm(dir)).toEqual([]);
  });

  it('story de texto: 201 com fundo padrão, sem arquivo, na lista, expira em 24 h e conta como PRIMEIRO_STORY', async () => {
    const antes = arquivosEm(dir).length;
    const r = await guardar(enviar(tecnico1).field('texto', '  Bora, galera!\nJogo hoje.  '));
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ tipo: 'TEXTO', url: null, capaUrl: null, texto: 'Bora, galera!\nJogo hoje.', fundo: 'gramado', visto: false, clube: { id: c[1] } });
    const exp = new Date(r.body.expiraEm).getTime() - new Date(r.body.criadoEm).getTime();
    expect(Math.abs(exp - 24 * 3_600_000)).toBeLessThan(5_000);
    const item = (await lista(torcedor)).flatMap((f) => f.stories).find((x) => x.id === r.body.id);
    expect(item).toEqual({ id: r.body.id, tipo: 'TEXTO', url: null, capaUrl: null, criadoEm: r.body.criadoEm, visto: false, texto: 'Bora, galera!\nJogo hoje.', fundo: 'gramado' });
    expect(arquivosEm(dir).length).toBe(antes);
    await vi.waitFor(async () => expect(await prisma.conquista.count({ where: { userId: tecnico1.id, tipo: 'PRIMEIRO_STORY' } })).toBe(1));
    // vencido: limpeza apaga a linha sem tropeçar no path nulo; apagar um vivo também
    await prisma.story.update({ where: { id: r.body.id }, data: { expiraEm: new Date(Date.now() - 1000) } });
    await app.get(CleanupService).limpar();
    expect(await prisma.story.count({ where: { id: r.body.id } })).toBe(0);
    const outro = await guardar(enviar(tecnico1).field('texto', 'x').field('fundo', 'azul'));
    expect(outro.body).toMatchObject({ fundo: 'azul' });
    await com('delete', `/api/stories/${outro.body.id}`, tecnico1).expect(204);
  });

  it('story de texto: CRLF do navegador é normalizado para \\n (193 letras + 7 quebras = 200 passa)', async () => {
    const r = await guardar(enviar(tecnico0).field('texto', ['a'.repeat(193), ...Array(7).fill('')].join('\r\n')));
    expect(r.status).toBe(201);
    expect((await prisma.story.findUnique({ where: { id: r.body.id } }))!.texto).toBe(['a'.repeat(193), ...Array(7).fill('')].join('\n').trim());
    const dois = await guardar(enviar(tecnico0).field('texto', 'a\r\nb\rc'));
    expect(dois.body.texto).toBe('a\nb\nc');
    await enviar(tecnico0).field('texto', 'a'.repeat(194) + '\r\nb'.repeat(7)).expect(400); // 201 depois de normalizar
  });

  it('story de texto inválido → 400: 201 caracteres, vazio, fundo desconhecido, texto + imagem/vídeo', async () => {
    await enviar(tecnico0).field('texto', 'a'.repeat(201)).expect(400);
    await enviar(tecnico0).field('texto', '   ').expect(400);
    expect((await enviar(tecnico0).field('texto', 'l\n'.repeat(8) + 'x').expect(400)).body).toMatchObject({ codigo: 'DADOS_INVALIDOS', campos: ['texto'] }); // 9 linhas
    const oito = await guardar(enviar(tecnico0).field('texto', Array(8).fill('l').join('\n'))); // 8 linhas (7 quebras)
    expect(oito.status).toBe(201);
    await enviar(tecnico0).field('texto', 'oi').field('fundo', 'rosa').expect(400);
    await enviar(tecnico0).field('texto', 'oi').attach('imagem', montarJpeg(10, 10), 's.jpg').expect(400);
    await enviar(tecnico0).field('texto', 'oi').attach('video', amostras.hevcMov, 'v.mov').expect(400);
    const ok = await guardar(enviar(tecnico0).field('texto', 'a'.repeat(200)));
    expect(ok.status).toBe(201);
  });

  it('story de texto: sem clube → 403 SEM_CLUBE; como CBF só o admin', async () => {
    expect((await enviar(torcedor).field('texto', 'oi').expect(403)).body.codigo).toBe('SEM_CLUBE');
    expect((await enviar(tecnico0).field('texto', 'oi').field('comoCbf', 'true').expect(403)).body.codigo).toBe('NAO_E_ADMIN');
    const r = await guardar(enviar(admin).field('texto', 'Aviso da CBF').field('comoCbf', 'true'));
    expect(r.body).toMatchObject({ tipo: 'TEXTO', clube: { id: 'cbf' } });
  });

  it('torcedor posta story → 403; só o admin posta como CBF', async () => {
    expect((await foto(torcedor).expect(403)).body.codigo).toBe('SEM_CLUBE');
    expect((await foto(tecnico0).field('comoCbf', 'true').expect(403)).body.codigo).toBe('NAO_E_ADMIN');
    const r = await guardar(foto(admin).field('comoCbf', 'true'));
    expect(r.status).toBe(201);
    expect(r.body.clube.id).toBe('cbf');
    expect((await lista(torcedor)).some((f) => f.clube.id === 'cbf')).toBe(true);
    await foto(admin).expect(403); // admin sem clube e sem comoCbf
    expect(arquivosEm(dir).length).toBe(1);
  });

  it('visto marca e todosVistos; as bolinhas não vistas vêm primeiro e a do story mais novo antes', async () => {
    const a = (await guardar(foto(tecnico0))).body;
    await new Promise((r) => setTimeout(r, 20));
    const b = (await guardar(foto(tecnico0))).body;
    await new Promise((r) => setTimeout(r, 20));
    const d = (await guardar(foto(tecnico1))).body;
    const meus = async () => (await lista(torcedor)).filter((f) => [c[0], c[1]].includes(f.clube.id));
    expect((await meus()).map((f) => f.clube.id)).toEqual([c[1], c[0]]); // o story mais novo é do clube 1
    expect((await meus())[1].stories.map((s) => s.id)).toEqual([a.id, b.id]); // do mais velho ao mais novo
    await com('put', `/api/stories/${d.id}/visto`, torcedor).expect(204);
    await com('put', `/api/stories/${d.id}/visto`, torcedor).expect(204); // repetir não explode
    await com('put', `/api/stories/${a.id}/visto`, torcedor).expect(204);
    let l = await meus();
    expect(l.map((f) => [f.clube.id, f.todosVistos])).toEqual([[c[0], false], [c[1], true]]); // clube 0 ainda tem o b
    expect(l[0].stories.map((s) => s.visto)).toEqual([true, false]);
    await com('put', `/api/stories/${b.id}/visto`, torcedor).expect(204);
    l = await meus();
    expect(l.map((f) => [f.clube.id, f.todosVistos])).toEqual([[c[1], true], [c[0], true]]); // todas vistas: pelo mais novo
    expect((await meusStories(tecnico1)).every((s) => !s.visto)).toBe(true); // visto é por pessoa
    await com('put', '/api/stories/lixo/visto', torcedor).expect(404);
  });

  it('vistos: só o autor ou o admin; sem o próprio autor', async () => {
    const s = (await guardar(foto(tecnico0))).body;
    await com('put', `/api/stories/${s.id}/visto`, torcedor).expect(204);
    await com('put', `/api/stories/${s.id}/visto`, tecnico0).expect(204);
    await com('put', `/api/stories/${s.id}/visto`, tecnico1).expect(204);
    for (const u of [tecnico0, admin]) {
      const v = (await com('get', `/api/stories/${s.id}/vistos`, u).expect(200)).body as { id: string; nome: string }[];
      expect(v.map((x) => x.id).sort()).toEqual([tecnico1.id, torcedor.id].sort());
      expect(v.find((x) => x.id === torcedor.id)).toEqual({ id: torcedor.id, nome: 'Torcedor Story' });
    }
    await com('get', `/api/stories/${s.id}/vistos`, torcedor).expect(403);
    await com('get', `/api/stories/${s.id}/vistos`, tecnico1).expect(403);
  });

  it('story expirado: fora do GET e 404 em visto, vistos e apagar', async () => {
    const s = (await guardar(foto(tecnico0))).body;
    await prisma.story.update({ where: { id: s.id }, data: { expiraEm: new Date(Date.now() - 1000) } });
    expect((await lista(torcedor)).flatMap((f) => f.stories).some((x) => x.id === s.id)).toBe(false);
    await com('put', `/api/stories/${s.id}/visto`, torcedor).expect(404);
    await com('get', `/api/stories/${s.id}/vistos`, tecnico0).expect(404);
    await com('delete', `/api/stories/${s.id}`, tecnico0).expect(404);
  });

  it('limpeza apaga a linha e o arquivo do expirado e mantém o vivo', async () => {
    const velho = (await guardar(enviar(tecnico0).attach('video', amostras.hevcMov, 'v.mov'))).body;
    const vivo = (await guardar(foto(tecnico0))).body;
    await prisma.story.update({ where: { id: velho.id }, data: { expiraEm: new Date(Date.now() - 1000) } });
    const arq = (u: string) => join(dir, u.replace('/uploads/', ''));
    expect([existsSync(arq(velho.url)), existsSync(arq(velho.capaUrl))]).toEqual([true, true]);
    await app.get(CleanupService).limpar();
    expect([existsSync(arq(velho.url)), existsSync(arq(velho.capaUrl))]).toEqual([false, false]);
    expect(await prisma.story.findUnique({ where: { id: velho.id } })).toBeNull();
    expect(existsSync(arq(vivo.url))).toBe(true);
    expect(await prisma.story.findUnique({ where: { id: vivo.id } })).not.toBeNull();
  });

  it('a limpeza também roda uma vez quando o back sobe (story vencido some sem esperar 1 h)', async () => {
    const velho = (await guardar(foto(tecnico0))).body;
    await prisma.story.update({ where: { id: velho.id }, data: { expiraEm: new Date(Date.now() - 1000) } });
    const arquivo = join(dir, velho.url.replace('/uploads/', ''));
    expect(existsSync(arquivo)).toBe(true);
    const segundo = await criarApp(); // novo boot, mesma pasta de uploads
    try {
      for (let i = 0; i < 40 && (await prisma.story.findUnique({ where: { id: velho.id } })); i++) await new Promise((r) => setTimeout(r, 50));
      expect(await prisma.story.findUnique({ where: { id: velho.id } })).toBeNull();
      expect(existsSync(arquivo)).toBe(false);
    } finally {
      await segundo.app.close();
    }
  });

  it('apagar: o autor, o técnico atual do clube ou o admin; outra pessoa → 403; apaga os arquivos', async () => {
    const meu = (await guardar(foto(tecnico0))).body;
    await com('delete', `/api/stories/${meu.id}`, torcedor).expect(403);
    await com('delete', `/api/stories/${meu.id}`, tecnico1).expect(403);
    await com('delete', `/api/stories/${meu.id}`, tecnico0).expect(204);
    expect(arquivosEm(dir)).toEqual([]);
    // story de outra autoria (ex-técnico) no clube do técnico atual
    const outro = (await guardar(foto(tecnico0))).body;
    await prisma.story.update({ where: { id: outro.id }, data: { autorId: admin.id } });
    await com('delete', `/api/stories/${outro.id}`, tecnico0).expect(204); // técnico atual do clube
    const cbf = (await guardar(foto(admin).field('comoCbf', 'true'))).body;
    await com('delete', `/api/stories/${cbf.id}`, tecnico0).expect(403);
    await com('delete', `/api/stories/${cbf.id}`, admin).expect(204);
    expect(await prisma.story.count({ where: { autorId: { in: usuarios } } })).toBe(0);
    expect(arquivosEm(dir)).toEqual([]);
  });

  it('exige sessão e Origin', async () => {
    await request(http()).get('/api/stories').set('Origin', ORIGIN).expect(401);
    await request(http()).post('/api/stories').attach('imagem', montarJpeg(10, 10), 's.jpg').expect(403);
  });
});
