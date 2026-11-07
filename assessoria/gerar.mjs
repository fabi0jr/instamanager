#!/usr/bin/env node
// Assessoria do Botafogo: preenche um modelo HTML, tira a "foto" com o Chrome headless e anima com o ffmpeg.
// Uso: node assessoria/gerar.mjs <formato> <dados.json>   |   node assessoria/gerar.mjs exemplos
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dentroDe } from './caminhos.mjs';
import { ACEITOS, sondaImagem } from './imagem.mjs';

const AQUI = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(AQUI, '..');
const FOTOS = join(AQUI, 'fotos');
const CLUBES = JSON.parse(readFileSync(join(AQUI, 'estadios.json'), 'utf8'));
const VIDEO_S = 8; // shortcut: duração fixa, o limite do app é 30 s
const TORCIDA = ['jpg', 'jpeg', 'png'].map((e) => join(AQUI, 'fotos/genericas', `torcida.${e}`));

export class ErroDados extends Error {}

const falta = (v) => v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0 && false);
const OBRIGATORIOS = {
  'fim-de-jogo': ['mandante', 'visitante', 'golsMandante', 'golsVisitante', 'gols', 'foto'],
  'nossos-onze': ['adversario', 'titulares', 'tecnico', 'reservas', 'foto'],
  'proxima-partida': ['competicao', 'rodadaOuFase', 'mandante', 'visitante', 'dataHora', 'foto'],
  'proxima-partida-video': ['competicao', 'rodadaOuFase', 'mandante', 'visitante', 'dataHora', 'foto'],
  'contratacao-video': ['nome', 'idade', 'posicao', 'foto'],
  coletiva: [],
  despedida: ['nome', 'foto'],
};
export const FORMATOS = Object.keys(OBRIGATORIOS);
const VIDEO = (f) => f.endsWith('-video');

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const url = (caminho) => pathToFileURL(resolve(REPO, caminho)).href;
// a foto só vale se estiver dentro de assessoria/fotos/ (nada de ../ nem caminho absoluto de fora, que viraria file:// no <img>)
const fotoUrl = (caminho) => {
  const abs = dentroDe(FOTOS, caminho, REPO);
  if (!abs) throw new ErroDados(`campo "foto": só aceita imagem dentro de assessoria/fotos/ (veio "${caminho}")`);
  return pathToFileURL(abs).href;
};
const escudo = (id, campo) => {
  if (!CLUBES[id]) throw new ErroDados(`campo "${campo}": clube "${id}" não existe (use o id do app, ex.: botafogo, atletico-mg)`);
  return url(`front/public/escudos/${id}.svg`);
};
const nomeClube = (id) => CLUBES[id].nome;

function validar(formato, d) {
  if (!OBRIGATORIOS[formato]) throw new ErroDados(`formato "${formato}" não existe. Formatos: ${FORMATOS.join(', ')}, foto`);
  for (const c of OBRIGATORIOS[formato]) if (falta(d[c])) throw new ErroDados(`campo "${c}" é obrigatório em ${formato}`);
  if (formato === 'nossos-onze' && d.titulares.length !== 11) throw new ErroDados(`campo "titulares" precisa de 11 jogadores (veio ${d.titulares.length})`);
  if (formato === 'fim-de-jogo')
    d.gols.forEach((g, i) => { for (const c of ['minuto', 'jogador', 'clube']) if (falta(g[c])) throw new ErroDados(`campo "gols[${i}].${c}" é obrigatório`); });
}

const DIAS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
// "2026-11-04T21:30:00-03:00" → "quarta-feira, 04 de novembro · 21h30" (horário de Brasília)
export function quando(iso) {
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) throw new ErroDados(`campo "dataHora" inválido: "${iso}" (use ISO, ex.: 2026-11-04T21:30:00-03:00)`);
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: 'numeric', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(t).map((x) => [x.type, x.value]));
  const dia = new Date(Date.UTC(+p.year, +p.month - 1, +p.day)).getUTCDay();
  return `${DIAS[dia]}, ${p.day} de ${MESES[+p.month - 1]} · ${p.hour === '24' ? '00' : p.hour}h${p.minute}`;
}

// valores de cada modelo: {{x}} sai escapado, {{{x}}} é HTML já montado aqui
function variaveis(formato, d) {
  const v = { foto: d.foto ? fotoUrl(d.foto) : '', escudoMandante: escudo('botafogo', 'botafogo') };
  if (formato === 'fim-de-jogo') {
    Object.assign(v, { escudoMandante: escudo(d.mandante, 'mandante'), escudoVisitante: escudo(d.visitante, 'visitante'), golsMandante: d.golsMandante, golsVisitante: d.golsVisitante,
      gols: d.gols.map((g) => `<div><img src="${escudo(g.clube, `gols.clube`)}">${esc(g.minuto)}’ ${esc(g.jogador)}</div>`).join('') });
  } else if (formato === 'nossos-onze') {
    Object.assign(v, { escudoVisitante: escudo(d.adversario, 'adversario'), tecnico: d.tecnico,
      titulares: d.titulares.map((j) => `<div data-fit><b>${esc(j.numero)}</b>${esc(j.nome)}${j.capitao ? ' ©' : ''}</div>`).join(''),
      reservas: d.reservas.map((j) => `<span>${esc(j.numero)} ${esc(j.nome)}</span>`).join(' ') });
  } else if (formato.startsWith('proxima-partida')) {
    escudo(d.mandante, 'mandante'); escudo(d.visitante, 'visitante');
    Object.assign(v, { escudoMandante: escudo(d.mandante, 'mandante'), escudoVisitante: escudo(d.visitante, 'visitante'), competicao: d.competicao, rodadaOuFase: d.rodadaOuFase,
      nomeMandante: nomeClube(d.mandante), nomeVisitante: nomeClube(d.visitante), estadio: d.estadio || CLUBES[d.mandante].estadio, quando: quando(d.dataHora) });
  } else if (formato === 'contratacao-video') Object.assign(v, { nome: d.nome, idade: d.idade, posicao: d.posicao });
  else if (formato === 'despedida') v.nome = d.nome;
  else if (formato === 'coletiva') v.foto = fotoUrl(d.foto || TORCIDA.find(existsSync) || TORCIDA[0]);
  return v;
}

// camada: 'completo' | 'fundo' | 'texto' (as duas últimas são as camadas do vídeo)
export function preencher(formato, dados, camada = 'completo') {
  validar(formato, dados);
  const v = variaveis(formato, dados);
  const modelo = readFileSync(join(AQUI, 'modelos', `${formato}.html`), 'utf8')
    .replace(/\{\{\{(\w+)\}\}\}/g, (_, k) => v[k] ?? '')
    .replace(/\{\{(\w+)\}\}/g, (_, k) => esc(v[k] ?? ''));
  const css = readFileSync(join(AQUI, 'modelos/base.css'), 'utf8').replaceAll('__FONTES__', pathToFileURL(join(AQUI, 'fontes')).href).replaceAll('__BARLOW__', pathToFileURL(join(REPO, 'front/public/fonts')).href);
  const fit = readFileSync(join(AQUI, 'modelos/fit.js'), 'utf8');
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><style>${css}</style></head><body class="camada-${camada}">${modelo}<script>${fit}</script></body></html>`;
}

const CHROME = process.env.CHROME || '/usr/bin/google-chrome';
const chrome = (args) => execFileSync(CHROME, ['--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars', '--disable-background-networking', '--disable-extensions', '--force-device-scale-factor=1', '--window-size=1080,1437', '--virtual-time-budget=8000', ...args], { stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024 });
const ffmpeg = (args) => execFileSync('/usr/bin/ffmpeg', ['-y', '-v', 'error', ...args], { stdio: ['ignore', 'ignore', 'inherit'] });

// roda o modelo no Chrome (sem foto) e devolve o DOM final: o teste lê data-fonte e data-cabe dos [data-fit]
export function dom(html, dir) {
  const arq = join(dir, `dom-${process.pid}.html`);
  writeFileSync(arq, html);
  try { return chrome(['--dump-dom', pathToFileURL(arq).href]).toString(); } finally { rmSync(arq, { force: true }); }
}

function foto(html, saida, dir, transparente = false) {
  const arq = join(dir, '_tmp.html');
  writeFileSync(arq, html);
  const bruto = join(dir, '_bruto.png');
  chrome([`--default-background-color=${transparente ? '00000000' : 'ff000000'}`, `--screenshot=${bruto}`, pathToFileURL(arq).href]);
  ffmpeg(['-i', bruto, '-vf', 'crop=1080:1350:0:0', '-frames:v', '1', '-update', '1', saida]); // a captura tem 87 px de barra no topo: fica só a viewport
}

export function pastaSaida(formato, base) {
  const d = new Date();
  const dia = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  let n = 1, dir;
  do { dir = join(base, `${dia}-${formato}${n > 1 ? `-${n}` : ''}`); n++; } while (existsSync(dir)); // não sobrescreve o que já saiu
  mkdirSync(dir, { recursive: true });
  return dir;
}

// formato `foto`: a montagem escolhida vira arte e mini, sem modelo HTML (por isso não está em FORMATOS)
function gerarFoto(dados, base) {
  if (falta(dados.foto)) throw new ErroDados('campo "foto" é obrigatório em foto');
  const abs = dentroDe(FOTOS, dados.foto, REPO) ?? dentroDe(join(AQUI, 'saidas'), dados.foto, REPO);
  if (!abs) throw new ErroDados(`campo "foto": só aceita imagem dentro de assessoria/fotos/ ou assessoria/saidas/ (veio "${dados.foto}")`);
  if (!existsSync(abs)) throw new ErroDados(`campo "foto": arquivo não existe: ${dados.foto}`);
  const s = sondaImagem(abs);
  if (!s) throw new ErroDados(`campo "foto": o arquivo não é uma imagem: ${dados.foto}`);
  if (!ACEITOS.includes(s.codec)) throw new ErroDados(`campo "foto": só aceita JPEG, PNG ou WebP (veio ${s.codec})`);
  const dir = pastaSaida('foto', base);
  const arte = join(dir, 'arte.jpg'), mini = join(dir, 'mini.jpg');
  ffmpeg(['-i', abs, '-vf', 'scale=1080:1350:force_original_aspect_ratio=increase,crop=1080:1350', '-frames:v', '1', '-update', '1', '-q:v', '2', arte]);
  ffmpeg(['-i', arte, '-vf', 'scale=800:800:force_original_aspect_ratio=decrease', '-frames:v', '1', '-update', '1', '-q:v', '3', mini]);
  return { arte, mini };
}

export function gerar(formato, dados, { base = join(AQUI, 'saidas') } = {}) {
  if (formato === 'foto') return gerarFoto(dados, base);
  const f = dados.foto ?? (formato === 'coletiva' ? TORCIDA.find(existsSync) : undefined);
  const html = preencher(formato, dados);
  if (f && !existsSync(resolve(REPO, f))) throw new ErroDados(`campo "foto": arquivo não existe: ${f}`);
  if (!f && formato === 'coletiva') throw new ErroDados('campo "foto": sem foto e sem fotos/genericas/torcida.jpg');
  const dir = pastaSaida(formato, base);
  const saidas = {};
  try {
    const completo = join(dir, '_completo.png');
    foto(html, completo, dir);
    const jpg = (de, para) => ffmpeg(['-i', de, '-frames:v', '1', '-update', '1', '-vf', 'scale=1080:1350', '-q:v', '2', para]);
    const mini = (de, para) => ffmpeg(['-i', de, '-frames:v', '1', '-update', '1', '-vf', 'scale=800:800:force_original_aspect_ratio=decrease', '-q:v', '3', para]);
    if (!VIDEO(formato)) {
      jpg(completo, join(dir, 'arte.jpg')); mini(join(dir, 'arte.jpg'), join(dir, 'mini.jpg'));
      Object.assign(saidas, { arte: join(dir, 'arte.jpg'), mini: join(dir, 'mini.jpg') });
    } else {
      foto(preencher(formato, dados, 'fundo'), join(dir, '_fundo.png'), dir);
      foto(preencher(formato, dados, 'texto'), join(dir, '_texto.png'), dir, true);
      // zoom lento no fundo (a 2x para não tremer) e os textos entram com fade e subida
      const filtro = `[0:v]scale=2160:2700,zoompan=z='1+0.00035*on':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1080x1350:fps=30[bg];` +
        `[1:v]format=rgba,fade=t=in:st=0.8:d=0.8:alpha=1[tx];[bg][tx]overlay=x=0:y='40*(1-min(1,max(0,(t-0.8)/0.8)))',format=yuv420p[v]`;
      ffmpeg(['-loop', '1', '-framerate', '30', '-t', String(VIDEO_S), '-i', join(dir, '_fundo.png'), '-loop', '1', '-framerate', '30', '-t', String(VIDEO_S), '-i', join(dir, '_texto.png'),
        '-filter_complex', filtro, '-map', '[v]', '-t', String(VIDEO_S), '-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-movflags', '+faststart', join(dir, 'video.mp4')]);
      jpg(completo, join(dir, 'capa.jpg'));
      Object.assign(saidas, { video: join(dir, 'video.mp4'), capa: join(dir, 'capa.jpg') });
    }
  } finally {
    for (const t of ['_completo.png', '_fundo.png', '_texto.png', '_tmp.html', '_bruto.png']) rmSync(join(dir, t), { force: true });
  }
  return saidas;
}

// node assessoria/gerar.mjs exemplos: foto de teste (ffmpeg) + um exemplo de cada formato
function exemplos() {
  const dir = join(AQUI, 'fotos/genericas');
  mkdirSync(dir, { recursive: true });
  const teste = join(dir, 'teste.jpg');
  if (!existsSync(teste)) ffmpeg(['-f', 'lavfi', '-i', 'testsrc2=s=1400x1800', '-frames:v', '1', '-update', '1', teste]);
  const out = {};
  for (const f of FORMATOS) {
    const dados = JSON.parse(readFileSync(join(AQUI, 'exemplos', `${f}.json`), 'utf8'));
    if (f === 'coletiva' || dados.foto) dados.foto = join('assessoria/fotos/genericas/teste.jpg');
    out[f] = gerar(f, dados);
  }
  return out;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [formato, arquivo] = process.argv.slice(2);
  try {
    const r = formato === 'exemplos' ? exemplos() : gerar(formato, JSON.parse(readFileSync(resolve(arquivo ?? '', ''), 'utf8')));
    console.log(JSON.stringify(r, null, 2));
  } catch (e) {
    console.error(e instanceof ErroDados ? `Erro: ${e.message}` : e.message);
    process.exit(1);
  }
}
