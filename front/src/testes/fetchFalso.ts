import { vi } from 'vitest';

type Resp = unknown | { status: number; corpo?: unknown } | (() => unknown);
// rotas: 'METHOD /caminho' → corpo JSON (200), { status, corpo } ou função (chamada a cada request, para respostas em sequência)
export function fetchFalso(rotas: Record<string, Resp>) {
  const chamadas: { chave: string; body?: BodyInit | null }[] = [];
  const fn = vi.fn(async (url: string, init?: RequestInit) => {
    const chave = `${init?.method ?? 'GET'} ${url.replace(/^\/api/, '')}`;
    chamadas.push({ chave, body: init?.body });
    if (!(chave in rotas)) throw new Error('rota sem mock: ' + chave);
    let r = rotas[chave];
    if (typeof r === 'function') r = r();
    if (r && typeof r === 'object' && 'status' in r) {
      const { status, corpo } = r as { status: number; corpo?: unknown };
      return new Response(status === 204 ? null : JSON.stringify(corpo ?? {}), { status });
    }
    return new Response(JSON.stringify(r));
  });
  vi.stubGlobal('fetch', fn);
  return chamadas;
}
