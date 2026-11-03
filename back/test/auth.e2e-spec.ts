import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { criarApp, novoEmail, ORIGIN, convite } from './helpers.js';
import type { PrismaService } from '../src/prisma.service.js';

// Clubes só deste arquivo (os e2e rodam em paralelo): flamengo, fluminense, botafogo, bahia.
describe('auth (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let post: Awaited<ReturnType<typeof criarApp>>['post'];
  let http: Awaited<ReturnType<typeof criarApp>>['http'];
  let codigo: string;
  const emails: string[] = [];
  const dados = (extra: object = {}) => {
    const email = novoEmail();
    emails.push(email);
    return { convite: codigo, email, senha: 'senha-boa-123', nome: 'Ana', clubeId: null, ...extra };
  };

  beforeAll(async () => {
    ({ app, prisma, post, http } = await criarApp());
    codigo = await convite(prisma);
  });
  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: emails } } });
    await app.close();
  });

  it('convite errado → 400 CONVITE_INVALIDO', async () => {
    const res = await post('/api/auth/cadastro', dados({ convite: 'errado' })).expect(400);
    expect(res.body.codigo).toBe('CONVITE_INVALIDO');
  });

  it('cadastro com clube livre cria CoachTenure aberta e Me.clube preenchido', async () => {
    const d = dados({ clubeId: 'flamengo' });
    const res = await post('/api/auth/cadastro', d).expect(201);
    expect(res.body).toMatchObject({ email: d.email, nome: 'Ana', isAdmin: false, pushEnabled: true, avatarUrl: null });
    expect(res.body.clube).toEqual({ id: 'flamengo', nome: 'Flamengo', escudoUrl: '/escudos/flamengo.svg' });
    expect(res.body.passwordHash).toBeUndefined();
    const t = await prisma.coachTenure.findMany({ where: { userId: res.body.id } });
    expect(t).toHaveLength(1);
    expect(t[0]).toMatchObject({ clubId: 'flamengo', endedAt: null });
  });

  it('cadastro com clubeId null → torcedor (Me.clube null)', async () => {
    const res = await post('/api/auth/cadastro', dados()).expect(201);
    expect(res.body.clube).toBeNull();
  });

  it('dois cadastros simultâneos no mesmo clube → um 201 e um 409 CLUBE_OCUPADO, e só 1 usuário criado', async () => {
    const a = dados({ clubeId: 'fluminense' });
    const b = dados({ clubeId: 'fluminense' });
    const [ra, rb] = await Promise.all([post('/api/auth/cadastro', a, '10.0.0.2'), post('/api/auth/cadastro', b, '10.0.0.3')]);
    expect([ra.status, rb.status].sort((x, y) => x - y)).toEqual([201, 409]);
    expect([ra, rb].find((r) => r.status === 409)!.body.codigo).toBe('CLUBE_OCUPADO');
    expect(await prisma.user.count({ where: { email: { in: [a.email, b.email] } } })).toBe(1);
    expect(await prisma.coachTenure.count({ where: { clubId: 'fluminense', endedAt: null } })).toBe(1);
  });

  it('clube inexistente → 404', async () => {
    await post('/api/auth/cadastro', dados({ clubeId: 'nao-existe' })).expect(404);
  });

  it('email repetido → 409 EMAIL_EM_USO', async () => {
    const d = dados();
    await post('/api/auth/cadastro', d).expect(201);
    const res = await post('/api/auth/cadastro', { ...d, nome: 'Outra' }).expect(409);
    expect(res.body.codigo).toBe('EMAIL_EM_USO');
  });

  it('dados inválidos → 400 DADOS_INVALIDOS com os campos', async () => {
    const res = await post('/api/auth/cadastro', dados({ senha: 'curta', nome: '' })).expect(400);
    expect(res.body.codigo).toBe('DADOS_INVALIDOS');
    expect(res.body.campos).toEqual(expect.arrayContaining(['senha', 'nome']));
  });

  it('email === ADMIN_EMAIL → isAdmin true', async () => {
    const d = dados();
    vi.stubEnv('ADMIN_EMAIL', d.email.toUpperCase());
    const res = await post('/api/auth/cadastro', d).expect(201);
    vi.unstubAllEnvs();
    expect(res.body.isAdmin).toBe(true);
  });

  it('entrar, GET /me, sair; senha errada → 401', async () => {
    const d = dados({ clubeId: 'botafogo' });
    await post('/api/auth/cadastro', d).expect(201);
    await post('/api/auth/entrar', { email: d.email, senha: 'errada-errada' }).expect(401);
    const res = await post('/api/auth/entrar', { email: d.email.toUpperCase(), senha: d.senha }).expect(200);
    const cookie = res.headers['set-cookie'];
    expect(cookie[0]).toMatch(/HttpOnly/i);
    const me = await request(http()).get('/api/me').set('Cookie', cookie).expect(200);
    expect(me.body.clube.id).toBe('botafogo');
    await post('/api/auth/sair', {}).set('Cookie', cookie).expect(204);
    await request(http()).get('/api/me').set('Cookie', cookie).expect(401);
  });

  it('GET /me sem sessão → 401 NAO_AUTENTICADO', async () => {
    const res = await request(http()).get('/api/me').expect(401);
    expect(res.body.codigo).toBe('NAO_AUTENTICADO');
  });

  it('pedido sem Origin → 403', async () => {
    await request(http()).post('/api/auth/entrar').send({}).expect(403);
  });

  describe('limites de tentativa', () => {
    const errar = (email: string, ip: string) => post('/api/auth/entrar', { email, senha: 'errada-errada' }, ip);

    it('login: 20 erros por conta, de IPs diferentes, bloqueiam o 21º com 429 (mesmo com a senha certa)', async () => {
      const d = dados();
      await post('/api/auth/cadastro', d).expect(201);
      for (let i = 0; i < 20; i++) await errar(d.email, `10.1.0.${i + 1}`).expect(401);
      const res = await post('/api/auth/entrar', { email: d.email, senha: d.senha }, '10.1.1.1').expect(429);
      expect(res.body.codigo).toBe('MUITAS_TENTATIVAS');
      expect(res.headers['retry-after']).toBeDefined();
    }, 30_000);

    it('login: acertar a senha zera os contadores da conta', async () => {
      const d = dados();
      await post('/api/auth/cadastro', d).expect(201);
      for (let i = 0; i < 9; i++) await errar(d.email, '10.2.0.1').expect(401);
      await post('/api/auth/entrar', { email: d.email, senha: d.senha }, '10.2.0.1').expect(200);
      // sem o reset, o 11º pedido do mesmo IP/e-mail já seria 429
      for (let i = 0; i < 9; i++) await errar(d.email, '10.2.0.1').expect(401);
    }, 30_000);
  });

  describe('PATCH /api/me', () => {
    const logar = async () => {
      const d = dados();
      const res = await post('/api/auth/cadastro', d).expect(201);
      return { d, cookie: res.headers['set-cookie'] as unknown as string[] };
    };
    const patch = (cookie: string[], body: object) =>
      request(http()).patch('/api/me').set('Origin', ORIGIN).set('Cookie', cookie).send(body);

    it('senhaAtual errada → 400 SENHA_ATUAL_INVALIDA', async () => {
      const { cookie } = await logar();
      const res = await patch(cookie, { senhaAtual: 'errada-errada', senhaNova: 'nova-senha-123' }).expect(400);
      expect(res.body.codigo).toBe('SENHA_ATUAL_INVALIDA');
    });

    it('senhaAtual: 6ª tentativa errada em 15 min → 429; acertar zera a contagem', async () => {
      const { d, cookie } = await logar();
      const errada = () => patch(cookie, { senhaAtual: 'errada-errada', senhaNova: 'nova-senha-123' });
      for (let i = 0; i < 4; i++) await errada().expect(400);
      await patch(cookie, { senhaAtual: d.senha, senhaNova: 'nova-senha-123' }).expect(200);
      // sem o reset, o 6º palpite (este é o 1º depois do acerto) já seria 429
      for (let i = 0; i < 5; i++) await errada().expect(400);
      const res = await errada().expect(429);
      expect(res.body.codigo).toBe('MUITAS_TENTATIVAS');
    }, 30_000);

    it('troca nome e pushEnabled; trocar a senha derruba as outras sessões e mantém a atual', async () => {
      const { d, cookie } = await logar();
      const outra = (await post('/api/auth/entrar', { email: d.email, senha: d.senha }).expect(200)).headers['set-cookie'] as unknown as string[];
      const res = await patch(cookie, { nome: 'Nova', pushEnabled: false, senhaAtual: d.senha, senhaNova: 'nova-senha-123' }).expect(200);
      expect(res.body).toMatchObject({ nome: 'Nova', pushEnabled: false });
      await request(http()).get('/api/me').set('Cookie', cookie).expect(200);
      await request(http()).get('/api/me').set('Cookie', outra).expect(401);
      await post('/api/auth/entrar', { email: d.email, senha: 'nova-senha-123' }).expect(200);
    });

    it('PUT /me/foto: JPEG vira avatarUrl; PNG → 400 IMAGEM_INVALIDA', async () => {
      const { cookie } = await logar();
      const dir = (await import('node:fs/promises')).mkdtemp;
      vi.stubEnv('UPLOADS_DIR', await dir((await import('node:os')).tmpdir() + '/im-foto-'));
      const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
      const put = (buf: Buffer) =>
        request(http()).put('/api/me/foto').set('Origin', ORIGIN).set('Cookie', cookie).attach('foto', buf, { filename: 'f.jpg', contentType: 'image/jpeg' });
      const ok = await put(jpeg).expect(200);
      expect(ok.body.avatarUrl).toMatch(/^\/uploads\/avatares\/[0-9a-f]{32}\.jpg$/);
      const ruim = await put(Buffer.from([0x89, 0x50, 0x4e, 0x47])).expect(400);
      expect(ruim.body.codigo).toBe('IMAGEM_INVALIDA');
      vi.unstubAllEnvs();
    });
  });
});
