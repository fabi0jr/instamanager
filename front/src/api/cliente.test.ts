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

test('api() guarda os campos do 400 DADOS_INVALIDOS no ErroApi', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ codigo: 'DADOS_INVALIDOS', mensagem: 'x', campos: ['email', 'senha'] }), { status: 400 })));
  const erro = await api('/auth/entrar', { method: 'POST' }).catch((e) => e as ErroApi);
  expect(erro.campos).toEqual(['email', 'senha']);
});

test('401 NAO_AUTENTICADO avisa o app (sessão expirada); credenciais erradas não', async () => {
  const aviso = vi.fn();
  addEventListener('sessao-expirada', aviso);
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ codigo: 'CREDENCIAIS_INVALIDAS' }), { status: 401 })));
  await api('/auth/entrar').catch(() => {});
  expect(aviso).not.toHaveBeenCalled();
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ codigo: 'NAO_AUTENTICADO' }), { status: 401 })));
  await api('/posts').catch(() => {});
  expect(aviso).toHaveBeenCalledTimes(1);
  removeEventListener('sessao-expirada', aviso);
});
