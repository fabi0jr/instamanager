import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test, { after } from 'node:test';
import { ErroMontagem, preparar, receber } from './montagem.mjs';

// "raiz do repo" falsa: assessoria/fotos e assessoria/saidas ficam num tmp, o repo de verdade não é tocado
const base = mkdtempSync(join(tmpdir(), 'montagem-'));
const fotos = join(base, 'assessoria/fotos');
const saidas = join(base, 'assessoria/saidas');
mkdirSync(join(fotos, 'genericas'), { recursive: true });
mkdirSync(saidas, { recursive: true });
after(() => rmSync(base, { recursive: true, force: true }));

const img = (arq, tam, extra = []) => execFileSync('/usr/bin/ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', `testsrc2=s=${tam}`, ...extra, '-frames:v', '1', '-update', '1', arq]);
const dim = (arq) => execFileSync('/usr/bin/ffprobe', ['-v', 'error', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', arq]).toString().trim();
const lado = (arq) => Math.max(...dim(arq).split(',').map(Number));
const pastas = () => readdirSync(saidas);

img(join(fotos, 'grande.jpg'), '5000x3000');
img(join(fotos, 'pessoa.jpg'), '800x1000');
img(join(fotos, 'genericas/camisa.jpg'), '600x600');
const pedido = (o = {}) => ({ texto: 'jogadores se abraçando', fotos: ['assessoria/fotos/grande.jpg', 'assessoria/fotos/pessoa.jpg'], ...o });

test('preparar: ref-1..N e camisa.jpg, cada uma com até 1536 px no lado maior, mesmo de uma foto de 5000×3000', () => {
  const r = preparar(pedido(), { base });
  assert.equal(r.versoes, 3);
  assert.equal(r.referencias.length, 2);
  assert.deepEqual(r.referencias.map((p) => p.split('/').pop()), ['ref-1.jpg', 'ref-2.jpg']);
  assert.equal(lado(r.referencias[0]), 1536);
  assert.equal(dim(r.referencias[1]), '800,1000'); // pequena não é ampliada
  assert.ok(existsSync(join(r.pasta, 'camisa.jpg')));
  assert.ok(lado(join(r.pasta, 'camisa.jpg')) <= 1536);
  assert.match(r.pasta, /\d{4}-\d{2}-\d{2}-montagem$/);
  assert.equal(preparar(pedido({ versoes: 4 }), { base }).versoes, 4);
  assert.match(preparar(pedido(), { base }).pasta, /-montagem-\d+$/); // não sobrescreve
});

test('preparar: pedido.txt = texto do Fabio + parte fixa', () => {
  const r = preparar(pedido({ texto: 'Dois jogadores se abraçando.' }), { base });
  const t = readFileSync(r.pedido, 'utf8');
  assert.ok(t.startsWith('Dois jogadores se abraçando.'));
  assert.ok(t.includes('Gere uma foto realista, estilo fotojornalismo esportivo, formato vertical 4:5. Mantenha os rostos exatamente como nas fotos de referência das pessoas. Todos vestem a camisa idêntica à imagem de referência da camisa. Sem texto, letras ou logotipos inventados na imagem.'));
});

test('preparar: foto fora de assessoria/fotos, 0 ou 5 fotos, versoes 5, camisa padrão ausente: erro claro e nenhuma pasta criada', () => {
  const antes = pastas();
  const ok = 'assessoria/fotos/pessoa.jpg';
  const casos = [
    [pedido({ fotos: ['/etc/passwd'] }), /assessoria\/fotos/],
    [pedido({ fotos: ['assessoria/fotos/../../x.jpg'] }), /assessoria\/fotos/],
    [pedido({ fotos: [ok], camisa: join(base, 'fora.jpg') }), /camisa/],
    [pedido({ fotos: ['assessoria/fotos/nao-existe.jpg'] }), /não existe/],
    [pedido({ fotos: [] }), /1 a 4/],
    [pedido({ fotos: Array(5).fill(ok) }), /1 a 4/],
    [pedido({ versoes: 5 }), /versoes/],
    [pedido({ texto: '  ' }), /texto/],
  ];
  for (const [p, re] of casos) assert.throws(() => preparar(p, { base }), (e) => e instanceof ErroMontagem && re.test(e.message), JSON.stringify(p));
  const semCamisa = mkdtempSync(join(tmpdir(), 'montagem-sem-'));
  try {
    mkdirSync(join(semCamisa, 'assessoria/fotos'), { recursive: true });
    mkdirSync(join(semCamisa, 'assessoria/saidas'), { recursive: true });
    img(join(semCamisa, 'assessoria/fotos/p.jpg'), '400x400');
    assert.throws(() => preparar({ texto: 'x', fotos: ['assessoria/fotos/p.jpg'] }, { base: semCamisa }), (e) => e instanceof ErroMontagem && /camisa/.test(e.message));
    assert.deepEqual(readdirSync(join(semCamisa, 'assessoria/saidas')), []);
  } finally { rmSync(semCamisa, { recursive: true, force: true }); }
  // arquivo que não é imagem: erro e a pasta criada some
  writeFileSync(join(fotos, 'lixo.jpg'), 'isto não é imagem');
  assert.throws(() => preparar(pedido({ fotos: ['assessoria/fotos/lixo.jpg'] }), { base }), ErroMontagem);
  assert.deepEqual(pastas(), antes);
});

test('receber: 2048×2048 vira v1.jpg 1080×1350; o segundo vira v2.jpg', () => {
  const { pasta } = preparar(pedido(), { base });
  const orig = join(base, 'gemini.png');
  img(orig, '2048x2048');
  assert.equal(receber(pasta, orig, { base }).versao, join(pasta, 'v1.jpg'));
  assert.equal(dim(join(pasta, 'v1.jpg')), '1080,1350');
  const wide = join(base, 'wide.webp');
  img(wide, '2400x1200');
  assert.equal(receber(pasta, wide, { base }).versao, join(pasta, 'v2.jpg'));
  assert.equal(dim(join(pasta, 'v2.jpg')), '1080,1350');
});

test('receber: imagem com 800 px no lado menor, arquivo de texto e arquivo vazio são recusados e nada é gravado', () => {
  const { pasta } = preparar(pedido(), { base });
  const antes = readdirSync(pasta).sort();
  const peq = join(base, 'peq.jpg'); img(peq, '800x1600');
  const txt = join(base, 'erro.html'); writeFileSync(txt, '<html>erro 403</html>');
  const vazio = join(base, 'vazio.png'); writeFileSync(vazio, '');
  const gif = join(base, 'a.gif'); img(gif, '1200x1200');
  for (const [f, re] of [[peq, /1000/], [txt, /imagem/], [vazio, /vazio/], [gif, /JPEG, PNG ou WebP/], [join(base, 'nao-existe.png'), /não existe/]])
    assert.throws(() => receber(pasta, f, { base }), (e) => e instanceof ErroMontagem && re.test(e.message), f);
  assert.deepEqual(readdirSync(pasta).sort(), antes);
});

test('receber: pasta fora de assessoria/saidas é recusada', () => {
  const orig = join(base, 'ok.png'); img(orig, '1500x1500');
  for (const p of [fotos, saidas, base, '/tmp', join(saidas, 'nao-existe')])
    assert.throws(() => receber(p, orig, { base }), (e) => e instanceof ErroMontagem && /assessoria\/saidas/.test(e.message), p);
});
