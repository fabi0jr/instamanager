import { readFileSync } from 'node:fs';
import { expect, test, vi } from 'vitest';

// carrega o sw.js num "self" falso e dispara os eventos
function carregar() {
  const ouvintes: Record<string, (e: any) => void> = {};
  const self = {
    addEventListener: (n: string, f: (e: any) => void) => (ouvintes[n] = f),
    registration: { showNotification: vi.fn() },
    clients: { matchAll: vi.fn(async () => []), openWindow: vi.fn() },
    skipWaiting: vi.fn(),
    location: { origin: 'https://x' },
  };
  new Function('self', readFileSync('public/sw.js', 'utf8'))(self);
  return { ouvintes, self };
}

test('push mostra a notificação com a url em data', async () => {
  const { ouvintes, self } = carregar();
  let p: Promise<unknown> = Promise.resolve();
  ouvintes.push({ data: { json: () => ({ titulo: 'Palmeiras', corpo: 'Lincoln postou', url: '/p/1' }) }, waitUntil: (x: Promise<unknown>) => (p = x) });
  await p;
  expect(self.registration.showNotification).toHaveBeenCalledWith('Palmeiras', expect.objectContaining({ body: 'Lincoln postou', data: { url: '/p/1' } }));
});

test('notificationclick abre a url quando não há janela', async () => {
  const { ouvintes, self } = carregar();
  let p: Promise<unknown> = Promise.resolve();
  const close = vi.fn();
  ouvintes.notificationclick({ notification: { close, data: { url: '/p/1' } }, waitUntil: (x: Promise<unknown>) => (p = x) });
  await p;
  expect(close).toHaveBeenCalled();
  expect(self.clients.openWindow).toHaveBeenCalledWith('https://x/p/1');
});

test('notificationclick com URL de outra origem abre /', async () => {
  const { ouvintes, self } = carregar();
  let p: Promise<unknown> = Promise.resolve();
  ouvintes.notificationclick({ notification: { close: vi.fn(), data: { url: 'https://mal.com' } }, waitUntil: (x: Promise<unknown>) => (p = x) });
  await p;
  expect(self.clients.openWindow).toHaveBeenCalledWith('/');
});

test('notificationclick foca a janela aberta e navega', async () => {
  const { ouvintes, self } = carregar();
  const janela = { focus: vi.fn(async () => janela), navigate: vi.fn(), url: 'https://x/' };
  self.clients.matchAll.mockResolvedValue([janela] as never);
  let p: Promise<unknown> = Promise.resolve();
  ouvintes.notificationclick({ notification: { close: vi.fn(), data: { url: '/p/1' } }, waitUntil: (x: Promise<unknown>) => (p = x) });
  await p;
  expect(janela.focus).toHaveBeenCalled();
  expect(janela.navigate).toHaveBeenCalledWith('https://x/p/1');
  expect(self.clients.openWindow).not.toHaveBeenCalled();
});
