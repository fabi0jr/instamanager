import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { _zerarErros, instalarCapturaDeErros, registrarErro } from './erros';

let chamadas: { url: string; body: string }[];
beforeEach(() => {
  _zerarErros();
  chamadas = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => { chamadas.push({ url, body: init.body as string }); return new Response(null, { status: 204 }); }));
});
afterEach(() => vi.unstubAllGlobals());

test('window.onerror e unhandledrejection mandam POST /api/erros-front no máx. 5 por minuto', () => {
  instalarCapturaDeErros();
  dispatchEvent(new ErrorEvent('error', { message: 'quebrou', error: new Error('quebrou') }));
  const rejeicao = new Event('unhandledrejection') as Event & { reason: unknown };
  rejeicao.reason = new Error('promessa');
  dispatchEvent(rejeicao);
  expect(chamadas.map((c) => c.url)).toEqual(['/api/erros-front', '/api/erros-front']);
  expect(JSON.parse(chamadas[0].body)).toMatchObject({ mensagem: 'quebrou', url: '/' });
  expect(JSON.parse(chamadas[1].body).mensagem).toBe('promessa');
  for (let i = 0; i < 10; i++) registrarErro('x' + i);
  expect(chamadas).toHaveLength(5);
  vi.useFakeTimers({ now: Date.now() + 61_000 });
  registrarErro('depois de 1 minuto');
  vi.useRealTimers();
  expect(chamadas).toHaveLength(6);
});

test('se o POST falhar não gera outro erro nem novo envio (sem loop)', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('sem rede'); }));
  const solta = vi.fn();
  addEventListener('unhandledrejection', solta);
  registrarErro('x');
  await new Promise((r) => setTimeout(r, 10));
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(solta).not.toHaveBeenCalled();
  removeEventListener('unhandledrejection', solta);
});
