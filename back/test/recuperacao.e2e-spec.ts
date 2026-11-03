import { createHash, randomBytes } from 'node:crypto';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { criarApp, novoEmail, convite } from './helpers.js';
import { hashPassword } from '../src/auth/password.js';
import type { PrismaService } from '../src/prisma.service.js';

describe('recuperação de senha (e2e, Resend mockado)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let post: Awaited<ReturnType<typeof criarApp>>['post'];
  let http: Awaited<ReturnType<typeof criarApp>>['http'];
  const fetchMock = vi.fn();
  const emails: string[] = [];
  let lidos = 0;

  const criarConta = async () => {
    const email = novoEmail();
    emails.push(email);
    await prisma.user.create({ data: { email, name: 'Ana', passwordHash: await hashPassword('senha-antiga-1') } });
    return email;
  };
  const proximoToken = async () => {
    await vi.waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThan(lidos));
    const body = JSON.parse(fetchMock.mock.calls[lidos++][1].body);
    return new URL(body.text.match(/https?:\/\/\S+/)[0]).searchParams.get('token')!;
  };
  const pedir = async (email: string) => {
    await post('/api/auth/esqueci', { email }).expect(204);
    return proximoToken();
  };

  beforeAll(async () => {
    ({ app, prisma, post, http } = await criarApp());
    await convite(prisma);
  });
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
    fetchMock.mockImplementation(async () => new Response('{"id":"1"}', { status: 200 }));
    lidos = 0;
    vi.stubEnv('RESEND_API_KEY', 're_teste');
    vi.stubEnv('MAIL_FROM', 'InstaManager <oi@instamanager.test>');
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });
  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: emails } } });
    await app.close();
  });

  it('esqueci responde 204 também para e-mail inexistente e não envia nada', async () => {
    await post('/api/auth/esqueci', { email: novoEmail() }).expect(204);
    await new Promise((r) => setTimeout(r, 100));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('esqueci + redefinir troca a senha, derruba as sessões e o token não serve de novo', async () => {
    const email = await criarConta();
    const sessao = (await post('/api/auth/entrar', { email, senha: 'senha-antiga-1' }).expect(200)).headers['set-cookie'];
    const token = await pedir(email);
    await post('/api/auth/redefinir', { token, senha: 'senha-nova-123' }).expect(204);
    await post('/api/auth/entrar', { email, senha: 'senha-antiga-1' }).expect(401);
    await post('/api/auth/entrar', { email, senha: 'senha-nova-123' }).expect(200);
    await request(http()).get('/api/me').set('Cookie', sessao).expect(401);
    const res = await post('/api/auth/redefinir', { token, senha: 'outra-senha-123' }).expect(400);
    expect(res.body.codigo).toBe('TOKEN_INVALIDO');
  });

  it('token vencido (>1h) → 400', async () => {
    const email = await criarConta();
    const token = await pedir(email);
    const tokenHash = createHash('sha256').update(token).digest('hex');
    await prisma.passwordReset.update({ where: { tokenHash }, data: { expiresAt: new Date(Date.now() - 1000) } });
    const res = await post('/api/auth/redefinir', { token, senha: 'senha-nova-123' }).expect(400);
    expect(res.body.codigo).toBe('TOKEN_INVALIDO');
  });

  it('token inventado → 400; novo pedido invalida o anterior', async () => {
    await post('/api/auth/redefinir', { token: randomBytes(16).toString('hex'), senha: 'senha-nova-123' }).expect(400);
    const email = await criarConta();
    const velho = await pedir(email);
    const novo = await pedir(email);
    await post('/api/auth/redefinir', { token: velho, senha: 'senha-nova-123' }).expect(400);
    await post('/api/auth/redefinir', { token: novo, senha: 'senha-nova-123' }).expect(204);
  });
});
