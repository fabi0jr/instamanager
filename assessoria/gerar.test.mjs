import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test, { after } from 'node:test';
import { fileURLToPath } from 'node:url';
import { dom, ErroDados, FORMATOS, gerar, preencher, quando } from './gerar.mjs';

const AQUI = dirname(fileURLToPath(import.meta.url));
const tmp = mkdtempSync(join(tmpdir(), 'assessoria-'));
// a foto de teste mora em assessoria/fotos/_teste/ (o gerador só aceita foto de lá); some no fim
const pastaFotos = join(AQUI, 'fotos/_teste');
mkdirSync(pastaFotos, { recursive: true });
const foto = 'assessoria/fotos/_teste/foto.jpg';
execFileSync('/usr/bin/ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'testsrc2=s=1400x1800', '-frames:v', '1', '-update', '1', join(AQUI, '..', foto)]);
after(() => { rmSync(tmp, { recursive: true, force: true }); rmSync(pastaFotos, { recursive: true, force: true }); });

const exemplo = (f) => ({ ...JSON.parse(readFileSync(join(AQUI, 'exemplos', `${f}.json`), 'utf8')), ...(f === 'coletiva' ? {} : { foto }) });
const sonda = (arq, campos) => execFileSync('/usr/bin/ffprobe', ['-v', 'error', '-show_entries', campos, '-of', 'default=nw=1', arq]).toString();
const letra = (html, classe) => { const m = dom(html, tmp).match(new RegExp(`class="${classe}"[^>]*data-fonte="(\\d+)" data-cabe="(\\d)"`)); assert.ok(m, `sem data-fonte em ${classe}`); return { fonte: +m[1], cabe: m[2] === '1' }; };

test('cada formato preenchido traz os dados', () => {
  const fim = preencher('fim-de-jogo', exemplo('fim-de-jogo'));
  for (const s of ['FIM DE JOGO', '>1<', '>0<', '19’ Edenilson']) assert.ok(fim.includes(s), s);
  const onze = preencher('nossos-onze', exemplo('nossos-onze'));
  for (const n of ['Gabriel Batista', 'Vitinho', 'Justino', 'Ferraresi', 'Marçal', 'Paulinho', 'Huguinho', 'Edenilson', 'Medina', 'Danilo Pereira', 'Tiquinho', 'Tite', 'Domingos']) assert.ok(onze.includes(n), n);
  assert.ok(onze.includes('Marçal ©')); // capitão com ©
  for (const f of ['proxima-partida', 'proxima-partida-video']) {
    const h = preencher(f, exemplo(f));
    for (const s of ['PRÓXIMA PARTIDA', 'Botafogo', 'Atlético-MG', 'VS', 'Estádio Nilton Santos', '34ª rodada', 'quarta-feira, 04 de novembro · 21h30']) assert.ok(h.includes(s), `${f}: ${s}`);
  }
  const c = preencher('contratacao-video', exemplo('contratacao-video'));
  for (const s of ['Danilo Pereira', '34 anos', 'Volante', 'Temporada 2026']) assert.ok(c.includes(s), s);
  assert.ok(preencher('coletiva', {}).includes('COLETIVA'));
  assert.ok(preencher('despedida', exemplo('despedida')).includes('OBRIGADO'));
});

test('estádio vem do mandante quando falta; o informado vence', () => {
  assert.ok(preencher('proxima-partida', { ...exemplo('proxima-partida'), mandante: 'vasco', visitante: 'botafogo' }).includes('São Januário'));
  assert.ok(preencher('proxima-partida', { ...exemplo('proxima-partida'), estadio: 'Arena Teste' }).includes('Arena Teste'));
});

test('a data sai em horário de Brasília', () => {
  assert.equal(quando('2026-11-04T21:30:00-03:00'), 'quarta-feira, 04 de novembro · 21h30');
  assert.equal(quando('2026-11-05T00:30:00Z'), 'quarta-feira, 04 de novembro · 21h30');
});

test('campo obrigatório faltando dá erro que cita o campo', () => {
  for (const f of FORMATOS) {
    const base = exemplo(f);
    for (const campo of Object.keys(base).filter((k) => k !== 'foto' || f !== 'coletiva')) {
      const { [campo]: _, ...sem } = base;
      if (['estadio'].includes(campo)) continue;
      assert.throws(() => preencher(f, sem), (e) => e instanceof ErroDados && e.message.includes(`"${campo}"`), `${f}/${campo}`);
    }
  }
  assert.throws(() => preencher('fim-de-jogo', { ...exemplo('fim-de-jogo'), visitante: 'time-que-nao-existe' }), /"visitante".*não existe/);
  assert.throws(() => preencher('proxima-partida', { ...exemplo('proxima-partida'), dataHora: 'amanhã' }), /"dataHora"/);
  assert.throws(() => preencher('nossos-onze', { ...exemplo('nossos-onze'), titulares: [] }), /"titulares"/);
  assert.throws(() => preencher('nao-existe', {}), /formato "nao-existe"/);
  assert.throws(() => gerar('despedida', { nome: 'X', foto: 'assessoria/fotos/_teste/sumiu.jpg' }, { base: tmp }), /"foto"/);
});

test('foto fora de assessoria/fotos/ é recusada (../ e caminho absoluto)', () => {
  for (const f of ['../../etc/passwd', '/etc/passwd', 'assessoria/fotos/../../.env', join(tmp, 'x.jpg'), 'assessoria/fotos']) {
    assert.throws(() => preencher('despedida', { nome: 'X', foto: f }), (e) => e instanceof ErroDados && /"foto".*assessoria\/fotos/.test(e.message), f);
    assert.throws(() => gerar('despedida', { nome: 'X', foto: f }, { base: tmp }), ErroDados, f);
  }
  assert.ok(preencher('despedida', { nome: 'X', foto }).includes('fotos/_teste/foto.jpg')); // a de dentro vale, relativa ou absoluta
  assert.ok(preencher('despedida', { nome: 'X', foto: join(AQUI, '..', foto) }).includes('fotos/_teste/foto.jpg'));
});

test('fim-de-jogo gera arte 1080x1350 e mini de 800 px no lado maior', () => {
  const r = gerar('fim-de-jogo', exemplo('fim-de-jogo'), { base: tmp });
  assert.match(sonda(r.arte, 'stream=width,height,codec_name'), /codec_name=mjpeg\s+width=1080\s+height=1350/);
  const m = sonda(r.mini, 'stream=width,height');
  assert.equal(Math.max(...[...m.matchAll(/=(\d+)/g)].map((x) => +x[1])), 800);
});

test('contratacao-video gera MP4 H.264 1080x1350, até 30 s, sem áudio', () => {
  const r = gerar('contratacao-video', exemplo('contratacao-video'), { base: tmp });
  const s = sonda(r.video, 'stream=codec_type,codec_name,width,height:format=duration');
  assert.match(s, /codec_name=h264/); assert.match(s, /width=1080/); assert.match(s, /height=1350/);
  assert.ok(!s.includes('codec_type=audio'));
  const dur = +s.match(/duration=([\d.]+)/)[1];
  assert.ok(dur > 1 && dur <= 30, `duração ${dur}`);
  assert.match(sonda(r.capa, 'stream=width,height'), /width=1080\s+height=1350/);
});

// Review Focus 5: o modelo reduz a letra por medida, já no Chrome
test('nome de 26 letras não transborda: a letra desce e cabe', () => {
  const curto = letra(preencher('contratacao-video', { ...exemplo('contratacao-video'), nome: 'Edu' }), 'nome');
  for (const nome of ['Danilo Pereira Dos Santos Jr', 'W'.repeat(26)]) {
    const longo = letra(preencher('contratacao-video', { ...exemplo('contratacao-video'), nome }), 'nome');
    assert.ok(longo.cabe, nome); assert.ok(longo.fonte < curto.fonte, `${nome}: ${longo.fonte} < ${curto.fonte}`);
  }
  const d = letra(preencher('despedida', { ...exemplo('despedida'), nome: 'W'.repeat(26) }), 'peq nome');
  assert.ok(d.cabe && d.fonte < 110, `despedida ${d.fonte}`);
});

test('formato foto: arte 1080×1350 e mini 800 a partir de saidas/; caminho fora de fotos/ e saidas/ dá erro', () => {
  const pasta = join(AQUI, 'saidas/_teste-foto');
  mkdirSync(pasta, { recursive: true });
  try {
    execFileSync('/usr/bin/ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'testsrc2=s=2000x1000', '-frames:v', '1', '-update', '1', join(pasta, 'v1.jpg')]);
    for (const f of ['assessoria/saidas/_teste-foto/v1.jpg', join(pasta, 'v1.jpg'), foto]) {
      const r = gerar('foto', { foto: f }, { base: tmp });
      assert.match(sonda(r.arte, 'stream=width,height'), /width=1080\s+height=1350/);
      const m = sonda(r.mini, 'stream=width,height');
      assert.equal(Math.max(...[...m.matchAll(/=(\d+)/g)].map((x) => +x[1])), 800);
    }
  } finally { rmSync(pasta, { recursive: true, force: true }); }
  for (const f of ['/etc/passwd', '../../etc/passwd', join(tmp, 'x.jpg'), 'assessoria/saidas', 'assessoria/saidas/../../.env'])
    assert.throws(() => gerar('foto', { foto: f }, { base: tmp }), (e) => e instanceof ErroDados && /"foto".*assessoria\/fotos.*assessoria\/saidas/.test(e.message), f);
  assert.throws(() => gerar('foto', {}, { base: tmp }), /"foto"/);
  assert.throws(() => gerar('foto', { foto: 'assessoria/saidas/nao-existe.jpg' }, { base: tmp }), /não existe/);
});

test('formato foto: recorta sem deformar e foto inválida não deixa pasta', () => {
  const quad = join(pastaFotos, 'quad.png');
  execFileSync('/usr/bin/ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'color=c=blue:s=2000x1000,drawbox=x=iw/2-100:y=ih/2-100:w=200:h=200:color=red:t=fill', '-frames:v', '1', '-update', '1', quad]);
  const r = gerar('foto', { foto: 'assessoria/fotos/_teste/quad.png' }, { base: tmp });
  const raw = execFileSync('/usr/bin/ffmpeg', ['-v', 'error', '-i', r.arte, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { maxBuffer: 64e6 });
  let x0 = 1080, x1 = -1, y0 = 1350, y1 = -1;
  for (let y = 0; y < 1350; y++) for (let x = 0; x < 1080; x++) { const i = (y * 1080 + x) * 3; if (raw[i] > 160 && raw[i + 1] < 90 && raw[i + 2] < 90) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } }
  assert.ok(Math.abs((x1 - x0) - (y1 - y0)) <= 2 && x1 - x0 > 200, `${x1 - x0 + 1}x${y1 - y0 + 1}`);
  writeFileSync(join(pastaFotos, 'erro.png'), '<html>erro</html>');
  const antes = readdirSync(tmp);
  assert.throws(() => gerar('foto', { foto: 'assessoria/fotos/_teste/erro.png' }, { base: tmp }), (e) => e instanceof ErroDados && /"foto".*não é uma imagem/.test(e.message));
  assert.deepEqual(readdirSync(tmp), antes);
});
