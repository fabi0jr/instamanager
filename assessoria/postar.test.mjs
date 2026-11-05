import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test, { after } from 'node:test';
import { fileURLToPath } from 'node:url';
import { ErroPostar, montarArgumentos, postar } from './postar.mjs';

const CHAVE = 'chave-de-teste';
const tmp = mkdtempSync(join(tmpdir(), 'postar-'));
const pasta = (nome, arquivos) => { const d = join(tmp, nome); mkdirSync(d); for (const [n, c] of Object.entries(arquivos)) writeFileSync(join(d, n), c); return d; };
after(() => rmSync(tmp, { recursive: true, force: true }));
// assíncrono de propósito: com spawnSync o servidor falso (neste processo) não responderia ao filho
const cli = (args, env) => new Promise((ok) => execFile('node', [join(dirname(fileURLToPath(import.meta.url)), 'postar.mjs'), ...args], { env: { ...process.env, ...env } }, (e, stdout, stderr) => ok({ status: e ? e.code : 0, stdout, stderr })));
const imagens = pasta('img', { 'arte.jpg': Buffer.from('ARTE-bytes'), 'mini.jpg': Buffer.from('MINI-bytes') });
const video = pasta('vid', { 'video.mp4': Buffer.from('VIDEO-bytes') });

// servidor MCP falso: confere Bearer/headers, guarda os corpos e responde JSON-RPC (JSON ou SSE)
async function servidor({ sse = false, resultado = { content: [{ type: 'text', text: '{"id":"p1"}' }] }, status = 200 } = {}) {
  const visto = { corpos: [], headers: [] };
  const s = createServer((req, res) => {
    let dados = '';
    req.on('data', (c) => (dados += c));
    req.on('end', () => {
      visto.headers.push(req.headers);
      if (req.method !== 'POST' || req.url !== '/mcp') { res.writeHead(404).end(); return; }
      if (req.headers.authorization !== `Bearer ${CHAVE}`) { res.writeHead(401).end('{}'); return; }
      if (status !== 200) { res.writeHead(status).end('falhou'); return; }
      const c = JSON.parse(dados);
      visto.corpos.push(c);
      if (c.id === undefined) { res.writeHead(202).end(); return; }
      const r = c.method === 'initialize' ? { protocolVersion: '2025-03-26', capabilities: {}, serverInfo: { name: 'x', version: '1' } } : resultado;
      const json = JSON.stringify({ jsonrpc: '2.0', id: c.id, result: r });
      if (sse) res.writeHead(200, { 'Content-Type': 'text/event-stream' }).end(`event: message\ndata: ${json}\n\n`);
      else res.writeHead(200, { 'Content-Type': 'application/json' }).end(json);
    });
  });
  await new Promise((ok) => s.listen(0, '127.0.0.1', ok));
  return { url: `http://127.0.0.1:${s.address().port}/mcp`, visto, fechar: () => { s.closeAllConnections(); s.close(); } };
}

test('imagens: initialize, depois tools/call com base64 de arte e mini, e devolve o id', async () => {
  const s = await servidor();
  try {
    const r = await postar({ pasta: imagens, legenda: 'Fim de jogo! "aspas" e\nquebra', url: s.url, chave: CHAVE });
    assert.equal(r, '{"id":"p1"}');
    assert.deepEqual(s.visto.corpos.map((c) => c.method), ['initialize', 'notifications/initialized', 'tools/call']);
    const h = s.visto.headers[0];
    assert.equal(h.authorization, `Bearer ${CHAVE}`);
    assert.equal(h.accept, 'application/json, text/event-stream');
    assert.match(h['content-type'], /application\/json/);
    const { name, arguments: a } = s.visto.corpos[2].params;
    assert.equal(name, 'postar_no_clube');
    assert.equal(a.legenda, 'Fim de jogo! "aspas" e\nquebra');
    assert.deepEqual(a.imagens, [{ cheia: Buffer.from('ARTE-bytes').toString('base64'), mini: Buffer.from('MINI-bytes').toString('base64') }]);
    assert.equal(a.video, undefined);
  } finally { s.fechar(); }
});

test('vídeo, resposta em SSE', async () => {
  const s = await servidor({ sse: true });
  try {
    assert.equal(await postar({ pasta: video, legenda: 'Reel', url: s.url, chave: CHAVE }), '{"id":"p1"}');
    const a = s.visto.corpos.at(-1).params.arguments;
    assert.equal(a.video, Buffer.from('VIDEO-bytes').toString('base64'));
    assert.equal(a.imagens, undefined);
  } finally { s.fechar(); }
});

test('isError da ferramenta vira erro com a mensagem; CLI sai com 1', async () => {
  const s = await servidor({ resultado: { isError: true, content: [{ type: 'text', text: 'SEM_CLUBE: o admin não tem clube' }] } });
  try {
    await assert.rejects(postar({ pasta: imagens, legenda: 'x', url: s.url, chave: CHAVE }), (e) => e instanceof ErroPostar && e.message === 'SEM_CLUBE: o admin não tem clube');
    const leg = join(tmp, 'legenda.txt'); writeFileSync(leg, 'Legenda\n');
    const r = await cli([imagens, leg], { ASSESSORIA_MCP_URL: s.url, ASSESSORIA_MCP_CHAVE: CHAVE });
    assert.equal(r.status, 1);
    assert.match(r.stderr, /SEM_CLUBE/);
    assert.ok(!r.stderr.includes(CHAVE) && !r.stdout.includes(CHAVE));
  } finally { s.fechar(); }
});

test('chave ausente, chave errada e MCP desligado dão erro claro', async () => {
  await assert.rejects(postar({ pasta: imagens, legenda: 'x', chave: '' }), /defina ASSESSORIA_MCP_CHAVE no \.env/);
  const s = await servidor();
  try {
    await assert.rejects(postar({ pasta: imagens, legenda: 'x', url: s.url, chave: 'errada' }), (e) => /401/.test(e.message) && !e.message.includes('errada'));
    await assert.rejects(postar({ pasta: imagens, legenda: 'x', url: s.url.replace('/mcp', '/outro'), chave: CHAVE }), /404/);
  } finally { s.fechar(); }
  const q = await servidor({ status: 500 });
  try { await assert.rejects(postar({ pasta: imagens, legenda: 'x', url: q.url, chave: CHAVE }), /500/); } finally { q.fechar(); }
});

test('pasta e legenda inválidas: nada é enviado', () => {
  assert.throws(() => montarArgumentos(imagens, '   '), /legenda/);
  assert.throws(() => montarArgumentos(pasta('vazia', {}), 'x'), /arte\.jpg/);
  assert.throws(() => montarArgumentos(pasta('semmini', { 'arte.jpg': 'a' }), 'x'), /mini\.jpg/);
  assert.throws(() => montarArgumentos(pasta('dois', { 'arte.jpg': 'a', 'mini.jpg': 'm', 'video.mp4': 'v' }), 'x'), /não os dois/);
});

test('CLI sem a chave manda o erro do .env', async () => {
  const leg = join(tmp, 'l2.txt'); writeFileSync(leg, 'x');
  // chave vazia no ambiente vale sobre qualquer .env (loadEnvFile não sobrescreve)
  const r = await cli([imagens, leg], { ASSESSORIA_MCP_CHAVE: '' });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /defina ASSESSORIA_MCP_CHAVE no \.env/);
});
