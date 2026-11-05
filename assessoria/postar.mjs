#!/usr/bin/env node
// Posta no clube do admin pelo MCP (ferramenta postar_no_clube), montando o base64 aqui: o modelo só passa a pasta e a legenda.
// Uso: node assessoria/postar.mjs <pasta-da-saida> <arquivo-legenda.txt>
// Config (ambiente ou .env da raiz): ASSESSORIA_MCP_CHAVE (obrigatória) e ASSESSORIA_MCP_URL (padrão abaixo).
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const URL_PADRAO = 'https://instamanager.fj-dev.tech/mcp';
export class ErroPostar extends Error {}

const b64 = (arq) => readFileSync(arq).toString('base64');

// {legenda, imagens:[{cheia, mini}]} ou {legenda, video}, conforme o que a pasta tem
export function montarArgumentos(pasta, legenda) {
  if (!legenda.trim()) throw new ErroPostar('a legenda está vazia');
  const f = (n) => join(pasta, n);
  const temArte = existsSync(f('arte.jpg')), temVideo = existsSync(f('video.mp4'));
  if (temArte === temVideo) throw new ErroPostar(`a pasta precisa ter arte.jpg + mini.jpg ou video.mp4 (e não os dois): ${pasta}`);
  if (temVideo) return { legenda, video: b64(f('video.mp4')) };
  if (!existsSync(f('mini.jpg'))) throw new ErroPostar(`falta mini.jpg em ${pasta}`);
  return { legenda, imagens: [{ cheia: b64(f('arte.jpg')), mini: b64(f('mini.jpg')) }] };
}

// resposta do MCP: JSON puro ou SSE (linhas "data: {...}")
const lerResposta = async (r) => {
  const t = await r.text();
  if ((r.headers.get('content-type') || '').includes('text/event-stream')) {
    const d = [...t.matchAll(/^data: (.*)$/gm)].map((m) => m[1]).filter(Boolean);
    return d.length ? JSON.parse(d[d.length - 1]) : null;
  }
  return t ? JSON.parse(t) : null;
};

export async function postar({ pasta, legenda, url = URL_PADRAO, chave }) {
  if (!chave) throw new ErroPostar('defina ASSESSORIA_MCP_CHAVE no .env');
  const args = montarArgumentos(pasta, legenda);
  const base = { Authorization: `Bearer ${chave}`, Accept: 'application/json, text/event-stream', 'Content-Type': 'application/json' };
  let sessao;
  let n = 0;
  const rpc = async (method, params, notificacao = false) => {
    const corpo = { jsonrpc: '2.0', method, ...(params && { params }), ...(notificacao ? {} : { id: ++n }) };
    const r = await fetch(url, { method: 'POST', headers: { ...base, ...(sessao && { 'Mcp-Session-Id': sessao }) }, body: JSON.stringify(corpo), signal: AbortSignal.timeout(170_000) });
    if (r.status === 401) throw new ErroPostar('o MCP recusou a chave (401): confira ASSESSORIA_MCP_CHAVE');
    if (r.status === 404) throw new ErroPostar('o MCP está desligado ou a URL está errada (404): confira ASSESSORIA_MCP_URL e MCP_CHAVE no servidor');
    if (!r.ok) throw new ErroPostar(`o MCP respondeu ${r.status}: ${(await r.text()).slice(0, 300)}`);
    sessao = r.headers.get('mcp-session-id') ?? sessao;
    if (notificacao) return null;
    const j = await lerResposta(r);
    if (j?.error) throw new ErroPostar(`erro do MCP: ${j.error.message}`);
    return j?.result;
  };
  await rpc('initialize', { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'assessoria', version: '1' } });
  await rpc('notifications/initialized', undefined, true);
  const res = await rpc('tools/call', { name: 'postar_no_clube', arguments: args });
  const texto = (res?.content ?? []).map((c) => c.text ?? '').join('\n');
  if (res?.isError) throw new ErroPostar(texto || 'a ferramenta deu erro');
  return texto;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [pasta, arqLegenda] = process.argv.slice(2);
  try {
    if (!pasta || !arqLegenda) throw new ErroPostar('uso: node assessoria/postar.mjs <pasta-da-saida> <arquivo-legenda.txt>');
    try { process.loadEnvFile(join(REPO, '.env')); } catch { /* sem .env: vale o ambiente */ }
    console.log(await postar({ pasta: resolve(pasta), legenda: readFileSync(arqLegenda, 'utf8').trim(), url: process.env.ASSESSORIA_MCP_URL || URL_PADRAO, chave: process.env.ASSESSORIA_MCP_CHAVE }));
  } catch (e) {
    console.error(`Erro: ${e.message}`);
    process.exit(1);
  }
}
