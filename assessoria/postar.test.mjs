import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test, { after } from 'node:test';
import { fileURLToPath } from 'node:url';
import { ErroPostar, montarArgumentos, postar, validarChave } from './postar.mjs';

const AQUI = dirname(fileURLToPath(import.meta.url));
const CHAVE = 'chave-de-teste';
const tmp = mkdtempSync(join(tmpdir(), 'postar-'));
const pasta = (nome, arquivos, base = tmp) => { const d = join(base, nome); mkdirSync(d, { recursive: true }); for (const [n, c] of Object.entries(arquivos)) writeFileSync(join(d, n), c); return d; };
// assíncrono de propósito: com spawnSync o servidor falso (neste processo) não responderia ao filho
const cli = (args, env) => new Promise((ok) => execFile('node', [join(AQUI, 'postar.mjs'), ...args], { env: { ...process.env, ...env } }, (e, stdout, stderr) => ok({ status: e ? e.code : 0, stdout, stderr })));
// a CLI só aceita pasta dentro de assessoria/saidas/: o teste dela usa uma pasta de teste lá, removida no fim
const dentro = pasta('_teste-postar', { 'arte.jpg': 'a', 'mini.jpg': 'm', 'legenda.txt': 'Legenda do post\n' }, join(AQUI, 'saidas'));
after(() => { rmSync(tmp, { recursive: true, force: true }); rmSync(dentro, { recursive: true, force: true }); });

const imagens = pasta('img', { 'arte.jpg': Buffer.from('ARTE-bytes'), 'mini.jpg': Buffer.from('MINI-bytes'), 'legenda.txt': 'Fim de jogo! "aspas" e\nquebra\n' });
const video = pasta('vid', { 'video.mp4': Buffer.from('VIDEO-bytes'), 'legenda.txt': 'Reel' });

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

test('imagens: initialize, depois tools/call com a legenda do legenda.txt e o base64 de arte e mini', async () => {
  const s = await servidor();
  try {
    assert.equal(await postar({ pasta: imagens, url: s.url, chave: CHAVE, base: tmp }), '{"id":"p1"}');
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
    assert.equal(await postar({ pasta: video, url: s.url, chave: CHAVE, base: tmp }), '{"id":"p1"}');
    const a = s.visto.corpos.at(-1).params.arguments;
    assert.equal(a.video, Buffer.from('VIDEO-bytes').toString('base64'));
    assert.equal(a.imagens, undefined);
    assert.equal(a.legenda, 'Reel');
  } finally { s.fechar(); }
});

test('isError da ferramenta vira erro com a mensagem; CLI sai com 1', async () => {
  const s = await servidor({ resultado: { isError: true, content: [{ type: 'text', text: 'SEM_CLUBE: o admin não tem clube' }] } });
  try {
    await assert.rejects(postar({ pasta: imagens, url: s.url, chave: CHAVE, base: tmp }), (e) => e instanceof ErroPostar && e.message === 'SEM_CLUBE: o admin não tem clube');
    const r = await cli([dentro], { ASSESSORIA_MCP_URL: s.url, ASSESSORIA_MCP_CHAVE: CHAVE });
    assert.equal(r.status, 1);
    assert.match(r.stderr, /SEM_CLUBE/);
    assert.ok(!r.stderr.includes(CHAVE) && !r.stdout.includes(CHAVE));
  } finally { s.fechar(); }
});

test('não há outro jeito de indicar o arquivo da legenda: a CLI recusa segundo argumento e postar() ignora "legenda"', async () => {
  const s = await servidor();
  try {
    const env = { ASSESSORIA_MCP_URL: s.url, ASSESSORIA_MCP_CHAVE: CHAVE };
    for (const extra of [['/etc/passwd'], ['.env'], ['--legenda', '.env']]) {
      const r = await cli([dentro, ...extra], env);
      assert.equal(r.status, 1, extra.join(' '));
      assert.match(r.stderr, /uso: node assessoria\/postar\.mjs <pasta-da-saida>/);
    }
    assert.equal((await cli([], env)).status, 1);
    assert.equal(s.visto.corpos.length, 0); // nada saiu
    await postar({ pasta: imagens, url: s.url, chave: CHAVE, base: tmp, legenda: 'OUTRA COISA', arquivoLegenda: '/etc/passwd' });
    assert.equal(s.visto.corpos.at(-1).params.arguments.legenda, 'Fim de jogo! "aspas" e\nquebra'); // sempre a do legenda.txt
  } finally { s.fechar(); }
});

test('link simbólico em arte.jpg, mini.jpg, video.mp4 ou legenda.txt para fora de saidas é recusado', async () => {
  const fora = join(tmp, 'segredo.txt'); writeFileSync(fora, 'SEGREDO');
  const base = pasta('base-links', {}); // as pastas abaixo ficam "dentro"; os alvos dos links ficam fora dela
  const casos = { 'legenda.txt': { 'arte.jpg': 'a', 'mini.jpg': 'm' }, 'arte.jpg': { 'legenda.txt': 'L', 'mini.jpg': 'm' }, 'mini.jpg': { 'legenda.txt': 'L', 'arte.jpg': 'a' }, 'video.mp4': { 'legenda.txt': 'L' } };
  const s = await servidor();
  try {
    for (const [arq, outros] of Object.entries(casos)) {
      const d = pasta(`l-${arq}`, outros, base);
      symlinkSync(fora, join(d, arq));
      await assert.rejects(postar({ pasta: d, url: s.url, chave: CHAVE, base }), (e) => e instanceof ErroPostar && /fora de assessoria\/saidas/.test(e.message), arq);
    }
    assert.equal(s.visto.corpos.length, 0);
  } finally { s.fechar(); }
});

test('chave: ausente, inválida (sem ecoar), errada e MCP desligado dão erro claro', async () => {
  await assert.rejects(postar({ pasta: imagens, chave: '', base: tmp }), /defina ASSESSORIA_MCP_CHAVE no \.env/);
  await assert.rejects(postar({ pasta: imagens, chave: '   \n', base: tmp }), /defina ASSESSORIA_MCP_CHAVE/);
  for (const ruim of ['com espaço', 'quebra\nlinha', 'acentuação-ç', 'tab\tx']) {
    assert.throws(() => validarChave(ruim), (e) => /ASCII visíveis/.test(e.message) && !e.message.includes(ruim.split(/\s/)[0] + '\n'));
  }
  assert.equal(validarChave('  abc123  \n'), 'abc123'); // trim
  const s = await servidor();
  try {
    await assert.rejects(postar({ pasta: imagens, url: s.url, chave: 'errada', base: tmp }), (e) => /401/.test(e.message) && !e.message.includes('errada'));
    await assert.rejects(postar({ pasta: imagens, url: s.url.replace('/mcp', '/outro'), chave: CHAVE, base: tmp }), /404/);
  } finally { s.fechar(); }
  const q = await servidor({ status: 500 });
  try { await assert.rejects(postar({ pasta: imagens, url: q.url, chave: CHAVE, base: tmp }), /500/); } finally { q.fechar(); }
});

test('pasta fora de assessoria/saidas/ é recusada antes de qualquer envio', async () => {
  const s = await servidor();
  try {
    await assert.rejects(postar({ pasta: imagens, url: s.url, chave: CHAVE }), /dentro de assessoria\/saidas/); // tmp está fora
    await assert.rejects(postar({ pasta: '../../etc', url: s.url, chave: CHAVE }), /dentro de assessoria\/saidas/);
    assert.equal(s.visto.corpos.length, 0);
  } finally { s.fechar(); }
});

test('pasta incompleta: nada é enviado', () => {
  assert.throws(() => montarArgumentos(pasta('semleg', { 'arte.jpg': 'a', 'mini.jpg': 'm' }), tmp), /legenda\.txt/);
  assert.throws(() => montarArgumentos(pasta('legvazia', { 'arte.jpg': 'a', 'mini.jpg': 'm', 'legenda.txt': '  \n' }), tmp), /legenda/);
  assert.throws(() => montarArgumentos(pasta('vazia', { 'legenda.txt': 'x' }), tmp), /arte\.jpg/);
  assert.throws(() => montarArgumentos(pasta('semmini', { 'arte.jpg': 'a', 'legenda.txt': 'x' }), tmp), /mini\.jpg/);
  assert.throws(() => montarArgumentos(pasta('dois', { 'arte.jpg': 'a', 'mini.jpg': 'm', 'video.mp4': 'v', 'legenda.txt': 'x' }), tmp), /não os dois/);
});

test('CLI sem a chave manda o erro do .env', async () => {
  // chave vazia no ambiente vale sobre qualquer .env (loadEnvFile não sobrescreve)
  const r = await cli([dentro], { ASSESSORIA_MCP_CHAVE: '' });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /defina ASSESSORIA_MCP_CHAVE no \.env/);
});
