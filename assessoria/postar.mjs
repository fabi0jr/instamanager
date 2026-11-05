#!/usr/bin/env node
// Posta no clube do admin pelo MCP (ferramenta postar_no_clube), montando o base64 aqui: o modelo só escreve legenda.txt na pasta e passa a pasta.
// Uso: node assessoria/postar.mjs <pasta-da-saida>   (a legenda vem SEMPRE de <pasta>/legenda.txt: nenhum argumento aponta outro arquivo)
// Config (ambiente ou .env da raiz): ASSESSORIA_MCP_CHAVE (obrigatória) e ASSESSORIA_MCP_URL (padrão abaixo).
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { dentroDe } from './caminhos.mjs';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SAIDAS = join(REPO, 'assessoria/saidas');
export const URL_PADRAO = 'https://instamanager.fj-dev.tech/mcp';
export class ErroPostar extends Error {}

const b64 = (arq) => readFileSync(arq).toString('base64');

// {legenda, imagens:[{cheia, mini}]} ou {legenda, video}, conforme o que a pasta tem. Todo arquivo lido precisa ficar
// (inclusive o caminho real, contra link simbólico) dentro de `base`.
export function montarArgumentos(pasta, base = SAIDAS) {
  const f = (n) => dentroDe(base, join(pasta, n), process.cwd()) ?? (() => { throw new ErroPostar(`${n} aponta para fora de assessoria/saidas/`); })();
  const tem = (n) => existsSync(f(n));
  if (!tem('legenda.txt')) throw new ErroPostar(`falta legenda.txt em ${pasta}`);
  const legenda = readFileSync(f('legenda.txt'), 'utf8').trim();
  if (!legenda) throw new ErroPostar('a legenda (legenda.txt) está vazia');
  const temArte = tem('arte.jpg'), temVideo = tem('video.mp4');
  if (temArte === temVideo) throw new ErroPostar(`a pasta precisa ter arte.jpg + mini.jpg ou video.mp4 (e não os dois): ${pasta}`);
  if (temVideo) return { legenda, video: b64(f('video.mp4')) };
  if (!tem('mini.jpg')) throw new ErroPostar(`falta mini.jpg em ${pasta}`);
  return { legenda, imagens: [{ cheia: b64(f('arte.jpg')), mini: b64(f('mini.jpg')) }] };
}

// chave: ASCII visível, sem espaço nem quebra de linha (senão vira cabeçalho quebrado); a mensagem não repete a chave
export function validarChave(chave) {
  const c = (chave ?? '').trim();
  if (!c) throw new ErroPostar('defina ASSESSORIA_MCP_CHAVE no .env');
  if (!/^[\x21-\x7E]+$/.test(c)) throw new ErroPostar('ASSESSORIA_MCP_CHAVE inválida: use só caracteres ASCII visíveis, sem espaços nem quebras de linha (confira o .env)');
  return c;
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

// `base` só muda nos testes: a pasta precisa estar dentro de assessoria/saidas/ (nada de ler arquivo de outro lugar e mandar ao MCP)
export async function postar({ pasta, url = URL_PADRAO, chave: chaveBruta, base = SAIDAS }) {
  const chave = validarChave(chaveBruta);
  const dir = dentroDe(base, pasta, process.cwd());
  if (!dir) throw new ErroPostar(`a pasta precisa estar dentro de assessoria/saidas/ (veio "${pasta}")`);
  const args = montarArgumentos(dir, base);
  const cab = { Authorization: `Bearer ${chave}`, Accept: 'application/json, text/event-stream', 'Content-Type': 'application/json' };
  let sessao;
  let n = 0;
  const rpc = async (method, params, notificacao = false) => {
    const corpo = { jsonrpc: '2.0', method, ...(params && { params }), ...(notificacao ? {} : { id: ++n }) };
    const r = await fetch(url, { method: 'POST', headers: { ...cab, ...(sessao && { 'Mcp-Session-Id': sessao }) }, body: JSON.stringify(corpo), signal: AbortSignal.timeout(170_000) });
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
  const [pasta, ...resto] = process.argv.slice(2);
  try {
    if (!pasta || resto.length) throw new ErroPostar('uso: node assessoria/postar.mjs <pasta-da-saida> (a legenda é <pasta>/legenda.txt)');
    try { process.loadEnvFile(join(REPO, '.env')); } catch { /* sem .env: vale o ambiente */ }
    console.log(await postar({ pasta: resolve(pasta), url: process.env.ASSESSORIA_MCP_URL || URL_PADRAO, chave: process.env.ASSESSORIA_MCP_CHAVE }));
  } catch (e) {
    console.error(`Erro: ${e.message}`);
    process.exit(1);
  }
}
