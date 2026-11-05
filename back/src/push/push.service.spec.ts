import webpush from 'web-push';
import { PushService } from './push.service.js';

vi.mock('web-push', () => ({ default: { setVapidDetails: vi.fn(), sendNotification: vi.fn() } }));

const msg = { titulo: 'Flamengo', corpo: 'Fulano postou', url: '/p/1' };
const sub = (id: string, userId = 'u1') => ({ id, userId, endpoint: `https://push.exemplo.test/${id}`, p256dh: 'k', auth: 'a' });

describe('PushService', () => {
  const prisma = { pushSubscription: { findMany: vi.fn(), deleteMany: vi.fn() } };
  const enviar = vi.mocked(webpush.sendNotification);
  let service: PushService;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('VAPID_PUBLIC_KEY', 'pub');
    vi.stubEnv('VAPID_PRIVATE_KEY', 'priv');
    vi.stubEnv('VAPID_SUBJECT', 'mailto:oi@exemplo.test');
    enviar.mockResolvedValue({ statusCode: 201, body: '', headers: {} });
    prisma.pushSubscription.deleteMany.mockResolvedValue({ count: 1 });
    service = new PushService(prisma as never);
  });
  afterEach(() => vi.unstubAllEnvs());

  it('com tipo, pula quem desligou aquele tipo (chave ausente vale ligado)', async () => {
    const com = (id: string, pushPrefs: object) => ({ ...sub(id), user: { pushPrefs } });
    prisma.pushSubscription.findMany.mockResolvedValue([com('liga', {}), com('desliga', { bolao: false }), com('outro', { posts: false })]);
    await service.enviar(['u1'], msg, 'bolao');
    expect(enviar.mock.calls.map((c) => (c[0] as { endpoint: string }).endpoint)).toEqual(['https://push.exemplo.test/liga', 'https://push.exemplo.test/outro']);
  });

  it('envia o JSON {titulo, corpo, url} para cada inscrição de quem tem push ligado', async () => {
    prisma.pushSubscription.findMany.mockResolvedValue([sub('a'), sub('b', 'u2')]);
    await service.enviar(['u1', 'u2'], msg);
    expect(prisma.pushSubscription.findMany).toHaveBeenCalledWith({ where: { userId: { in: ['u1', 'u2'] }, user: { pushEnabled: true } }, include: { user: { select: { pushPrefs: true } } } });
    expect(enviar).toHaveBeenCalledTimes(2);
    expect(enviar.mock.calls[0][0]).toMatchObject({ endpoint: 'https://push.exemplo.test/a', keys: { p256dh: 'k', auth: 'a' } });
    expect(JSON.parse(enviar.mock.calls[0][1] as string)).toEqual(msg);
    expect(webpush.setVapidDetails).toHaveBeenCalledWith('mailto:oi@exemplo.test', 'pub', 'priv');
  });

  it('resposta 410 (ou 404) apaga a inscrição e continua as outras', async () => {
    prisma.pushSubscription.findMany.mockResolvedValue([sub('velha'), sub('morta'), sub('boa')]);
    enviar.mockImplementation(async (s) => {
      const { endpoint } = s as { endpoint: string };
      if (endpoint.endsWith('/velha')) throw Object.assign(new Error('Gone'), { statusCode: 410 });
      if (endpoint.endsWith('/morta')) throw Object.assign(new Error('Not Found'), { statusCode: 404 });
      return { statusCode: 201, body: '', headers: {} };
    });
    await service.enviar(['u1'], msg);
    expect(enviar).toHaveBeenCalledTimes(3);
    expect(prisma.pushSubscription.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ['velha', 'morta'] } } });
  });

  it('erro 500 de um endpoint não derruba os outros nem apaga a inscrição', async () => {
    prisma.pushSubscription.findMany.mockResolvedValue([sub('ruim'), sub('boa')]);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    enviar.mockImplementation(async (s) => {
      if ((s as { endpoint: string }).endpoint.endsWith('/ruim')) throw Object.assign(new Error('boom'), { statusCode: 500 });
      return { statusCode: 201, body: '', headers: {} };
    });
    await expect(service.enviar(['u1'], msg)).resolves.toBeUndefined();
    expect(enviar).toHaveBeenCalledTimes(2);
    expect(prisma.pushSubscription.deleteMany).not.toHaveBeenCalled();
  });

  it('sem chaves VAPID não envia nem lança; sem destinatários nem consulta o banco', async () => {
    vi.stubEnv('VAPID_PRIVATE_KEY', '');
    prisma.pushSubscription.findMany.mockResolvedValue([sub('a')]);
    await expect(new PushService(prisma as never).enviar(['u1'], msg)).resolves.toBeUndefined();
    expect(enviar).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
    vi.stubEnv('VAPID_PUBLIC_KEY', 'pub');
    vi.stubEnv('VAPID_PRIVATE_KEY', 'priv');
    vi.stubEnv('VAPID_SUBJECT', 'mailto:oi@exemplo.test');
    prisma.pushSubscription.findMany.mockClear();
    await service.enviar([], msg);
    expect(prisma.pushSubscription.findMany).not.toHaveBeenCalled();
  });
});
