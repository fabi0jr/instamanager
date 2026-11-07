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
// imagem azul com um quadrado vermelho no centro; devolve a largura e a altura do vermelho depois de processada
const comQuadrado = (arq, tam) => execFileSync('/usr/bin/ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', `color=c=blue:s=${tam},drawbox=x=iw/2-100:y=ih/2-100:w=200:h=200:color=red:t=fill`, '-frames:v', '1', '-update', '1', arq]);
const caixaVermelha = (arq) => {
  const [w, h] = dim(arq).split(',').map(Number);
  const raw = execFileSync('/usr/bin/ffmpeg', ['-v', 'error', '-i', arq, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { maxBuffer: 64e6 });
  let x0 = w, x1 = -1, y0 = h, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 3;
    if (raw[i] > 160 && raw[i + 1] < 90 && raw[i + 2] < 90) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  }
  return { w: x1 - x0 + 1, h: y1 - y0 + 1 };
};
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
  assert.ok(t.includes('Gere uma foto realista, estilo fotojornalismo esportivo, formato vertical 4:5. Mantenha os rostos exatamente como nas fotos de referência das pessoas. Todos vestem a camisa da imagem de referência da camisa: mesmas listras verticais pretas e brancas e o mesmo escudo, mas no modelo moderno de jogo, gola redonda, sem assinatura e sem número. Sem texto, letras ou logotipos inventados na imagem.'));
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

test('receber: imagem com 700 px no lado menor, arquivo de texto e arquivo vazio são recusados e nada é gravado', () => {
  const { pasta } = preparar(pedido(), { base });
  const antes = readdirSync(pasta).sort();
  const peq = join(base, 'peq.jpg'); img(peq, '700x1600');
  const vazio = join(base, 'x.dat'); writeFileSync(vazio, '');
  const gif = join(base, 'a.gif'); img(gif, '1200x1200');
  const casos = [[peq, /800 px/], [vazio, /arquivo vazio/], [gif, /JPEG, PNG ou WebP/], [join(base, 'nao-existe.png'), /não existe/]];
  // HTML de erro salvo com qualquer extensão de imagem: o ffprobe diz png,0,0 e não pode virar "pequena demais"
  for (const ext of ['html', 'png', 'jpg', 'webp']) { const f = join(base, `erro.${ext}`); writeFileSync(f, '<html>erro 403</html>'); casos.push([f, /não é uma imagem/]); }
  for (const [f, re] of casos) assert.throws(() => receber(pasta, f, { base }), (e) => e instanceof ErroMontagem && re.test(e.message) && !(/pequena/.test(e.message) && /não é uma imagem/.test(re.source)), f);
  assert.deepEqual(readdirSync(pasta).sort(), antes);
});

test('receber: 896×1152 (4:5 do Gemini) é aceita', () => {
  const { pasta } = preparar(pedido(), { base });
  const f = join(base, 'g.png'); img(f, '896x1152');
  assert.equal(dim(receber(pasta, f, { base }).versao), '1080,1350');
});

test('receber: recorta sem deformar (o quadrado continua quadrado)', () => {
  const { pasta } = preparar(pedido(), { base });
  const f = join(base, 'quad.png'); comQuadrado(f, '2000x1000');
  const { w, h } = caixaVermelha(receber(pasta, f, { base }).versao);
  assert.ok(Math.abs(w - h) <= 2 && w > 200, `${w}x${h}`);
});

test('receber: arquivo relativo resolve pelo cwd, não pela raiz do repo', () => {
  const { pasta } = preparar(pedido(), { base });
  const dir = mkdtempSync(join(tmpdir(), 'cwd-'));
  const antes = process.cwd();
  try {
    img(join(dir, 'rel.png'), '1200x1200');
    process.chdir(dir);
    assert.equal(dim(receber(pasta, 'rel.png', { base }).versao), '1080,1350');
  } finally { process.chdir(antes); rmSync(dir, { recursive: true, force: true }); }
});

test('preparar: referência que não é imagem parada (mp4) é recusada e nenhuma pasta fica', () => {
  const antes = pastas();
  execFileSync('/usr/bin/ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'testsrc2=s=400x400:d=0.3', '-c:v', 'libx264', join(fotos, 'v.mp4')]);
  assert.throws(() => preparar(pedido({ fotos: ['assessoria/fotos/v.mp4'] }), { base }), (e) => e instanceof ErroMontagem && /JPEG, PNG ou WebP/.test(e.message));
  assert.deepEqual(pastas(), antes);
});

test('receber: pasta fora de assessoria/saidas é recusada', () => {
  const orig = join(base, 'ok.png'); img(orig, '1500x1500');
  for (const p of [fotos, saidas, base, '/tmp', join(saidas, 'nao-existe')])
    assert.throws(() => receber(p, orig, { base }), (e) => e instanceof ErroMontagem && /assessoria\/saidas/.test(e.message), p);
});
