import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { PrismaService } from '../src/prisma.service.js';
import { cadastrarUsuario, criarApp, ORIGIN } from './helpers.js';

// O código de convite é global (uma linha em Setting): este teste o troca por instantes. Por isso roda
// sozinho, DEPOIS dos outros e2e (project "serial" em vitest.config.e2e.ts), para não derrubar cadastros alheios.
describe('convite (e2e, serial)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let post: Awaited<ReturnType<typeof criarApp>>['post'];
  let http: () => ReturnType<INestApplication['getHttpServer']>;
  let admin: Awaited<ReturnType<typeof cadastrarUsuario>>;
  const ids: string[] = [];
  const comoAdmin = (m: 'get' | 'put', url: string) => request(http())[m](url).set('Origin', ORIGIN).set('Cookie', admin.cookie);

  beforeAll(async () => {
    ({ app, prisma, post, http } = await criarApp());
    admin = await cadastrarUsuario(post, prisma, null, 'Admin');
    ids.push(admin.id);
    await prisma.user.update({ where: { id: admin.id }, data: { isAdmin: true } });
  });
  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await app.close();
  });

  it('PUT convite → cadastro com o código antigo falha, com o novo funciona; 4 a 64 caracteres', async () => {
    const atual = (await comoAdmin('get', '/api/admin/convite').expect(200)).body.codigo as string;
    expect(atual).toEqual(expect.any(String));
    await comoAdmin('put', '/api/admin/convite').send({ codigo: 'abc' }).expect(400);
    await comoAdmin('put', '/api/admin/convite').send({ codigo: 'x'.repeat(65) }).expect(400);
    try {
      const salvo = await comoAdmin('put', '/api/admin/convite').send({ codigo: '  novo-codigo-xyz ' }).expect(200);
      expect(salvo.body.codigo).toBe('NOVO-CODIGO-XYZ'); // trim + maiúsculas na gravação
      const dados = (convite: string) => ({ convite, email: `teste-${Math.random().toString(36).slice(2)}@exemplo.com`, senha: 'senha-boa-123', nome: 'X', clubeId: null });
      expect((await post('/api/auth/cadastro', dados(atual), '10.9.9.1').expect(400)).body.codigo).toBe('CONVITE_INVALIDO');
      // não diferencia maiúsculas nem espaços nas pontas: quem digita no celular erra a caixa
      const ok = await post('/api/auth/cadastro', dados('novo-codigo-xyz'), '10.9.9.2').expect(201);
      const ok2 = await post('/api/auth/cadastro', dados('  Novo-Codigo-XYZ '), '10.9.9.3').expect(201);
      ids.push(ok.body.id, ok2.body.id);
      expect((await post('/api/auth/cadastro', dados('novo-codigo-xy'), '10.9.9.4').expect(400)).body.codigo).toBe('CONVITE_INVALIDO');
    } finally {
      await comoAdmin('put', '/api/admin/convite').send({ codigo: atual }); // restaura na hora
    }
    expect((await comoAdmin('get', '/api/admin/convite').expect(200)).body.codigo).toBe(atual.toUpperCase());
  });
});
