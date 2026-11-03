import { afterEach, expect, test, vi } from 'vitest';
import { api, ErroApi } from './cliente';

afterEach(() => vi.unstubAllGlobals());

test('api() com 409 lança ErroApi com o codigo do corpo', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ codigo: 'CLUBE_OCUPADO', mensagem: 'x' }), { status: 409 })));
  const erro = await api('/clubes').catch((e) => e);
  expect(erro).toBeInstanceOf(ErroApi);
  expect(erro).toMatchObject({ status: 409, codigo: 'CLUBE_OCUPADO' });
});

test('api() devolve o JSON e undefined em 204', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ a: 1 }))));
  expect(await api('/x')).toEqual({ a: 1 });
  vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 204 })));
  expect(await api('/x', { method: 'POST' })).toBeUndefined();
});

test('api() sem corpo JSON no erro ainda lança ErroApi', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>', { status: 502 })));
  await expect(api('/x')).rejects.toMatchObject({ status: 502, codigo: 'ERRO_DESCONHECIDO' });
});
