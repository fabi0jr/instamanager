import { request as httpRequest } from 'node:http';
import { Logger } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { vi } from 'vitest';
import type { PrismaService } from '../src/prisma.service.js';
import { cadastrarUsuario, criarApp, ORIGIN } from './helpers.js';

let ipSeq = 0;
const novoIp = () => `10.41.${Math.floor(++ipSeq / 250)}.${(ipSeq % 250) + 1}`; // cada teste com o seu IP: o limite é por IP

describe('POST /api/erros-front (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let http: () => ReturnType<INestApplication['getHttpServer']>;
  let aviso: ReturnType<typeof vi.spyOn>;
  const ids: string[] = [];
  const corpo = (extra: object = {}) => ({ mensagem: 'TypeError: x is undefined', url: '/p/123', versao: 'abc123', ...extra });
  const enviar = (ip: string, body: object | string, cookie?: string[]) => {
    const r = request(http()).post('/api/erros-front').set('Origin', ORIGIN).set('X-Forwarded-For', ip).set('Content-Type', 'application/json');
    return (cookie ? r.set('Cookie', cookie) : r).send(typeof body === 'string' ? body : JSON.stringify(body));
  };
  /** JSON com exatamente `bytes` bytes (ASCII), preenchendo a pilha. */
  const comTamanho = (bytes: number) => {
    const vazio = JSON.stringify(corpo({ pilha: '' })).length;
    return JSON.stringify(corpo({ pilha: 'x'.repeat(bytes - vazio) }));
  };

  beforeAll(async () => {
    ({ app, prisma, http } = await criarApp());
  });
  beforeEach(() => {
    aviso = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => aviso.mockRestore());
  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await app.close();
  });

  it('público: aceita sem sessão → 204 e registra no log (sem userId)', async () => {
    await enviar(novoIp(), corpo({ pilha: 'at foo (a.js:1)' })).expect(204);
    expect(aviso).toHaveBeenCalledTimes(1);
    const linha = String(aviso.mock.calls[0][0]);
    expect(linha).toContain('erro-front');
    expect(linha).toContain('TypeError: x is undefined');
    expect(linha).toContain('abc123');
    expect(linha).not.toContain('userId');
  });

  it('com sessão registra só o userId (nunca e-mail ou nome)', async () => {
    const c = await criarApp();
    const u = await cadastrarUsuario(c.post, c.prisma, null, 'Fulano Sigiloso');
    ids.push(u.id);
    await c.app.close();
    await enviar(novoIp(), corpo(), u.cookie).expect(204);
    const linha = String(aviso.mock.calls[0][0]);
    expect(linha).toContain(u.id);
    expect(linha).not.toContain(u.email);
    expect(linha).not.toContain('Sigiloso');
  });

  it('aceita 4 KB exatos; 5 KB → 413', async () => {
    await enviar(novoIp(), comTamanho(4096)).expect(204);
    const res = await enviar(novoIp(), comTamanho(5 * 1024)).expect(413);
    expect(res.body.codigo).toBeDefined();
    expect(aviso).toHaveBeenCalledTimes(1); // o de 5 KB não foi registrado
  });

  it('corpo grande sem Content-Length (chunked) também → 413', async () => {
    await app.listen(0);
    const { port } = app.getHttpServer().address() as { port: number };
    const status = await new Promise<number>((resolve, reject) => {
      const r = httpRequest({ port, method: 'POST', path: '/api/erros-front', headers: { Origin: ORIGIN, 'X-Forwarded-For': novoIp(), 'Content-Type': 'application/json', 'Transfer-Encoding': 'chunked' } }, (res) => {
        res.resume();
        resolve(res.statusCode ?? 0);
      });
      r.on('error', reject);
      r.write(comTamanho(8 * 1024));
      r.end();
    });
    expect(status).toBe(413);
  });

  it('31ª requisição no minuto do mesmo IP → 429 com Retry-After; outro IP segue livre', async () => {
    const ip = novoIp();
    for (let i = 0; i < 30; i++) await enviar(ip, corpo()).expect(204);
    const res = await enviar(ip, corpo()).expect(429);
    expect(Number(res.headers['retry-after'])).toBeGreaterThan(0);
    await enviar(novoIp(), corpo()).expect(204);
  });

  it('valida os campos (mensagem obrigatória, tipos) → 400 e nada no log; exige Origin', async () => {
    const ip = novoIp();
    for (const ruim of [{}, { mensagem: '' }, { mensagem: 5 }, corpo({ url: 7 }), corpo({ pilha: 7 }), corpo({ versao: {} }), '[]', '"x"', 'nao é json'])
      expect((await enviar(ip, ruim as object)).status, JSON.stringify(ruim)).toBe(400);
    expect(aviso).not.toHaveBeenCalled();
    await request(http()).post('/api/erros-front').set('X-Forwarded-For', novoIp()).send(corpo()).expect(403);
  });

  it('texto longo é cortado no log e quebras de linha não forjam linhas de log', async () => {
    await enviar(novoIp(), corpo({ mensagem: 'm'.repeat(1500) + '\nFALSO [warn] admin entrou', pilha: 'p'.repeat(1500) })).expect(204);
    const linha = String(aviso.mock.calls[0][0]);
    expect(linha).not.toContain('\n');
    expect(linha).not.toContain('m'.repeat(501));
    expect(linha).not.toContain('FALSO'); // veio depois do corte
    expect(linha.length).toBeLessThan(3000);
  });
});
