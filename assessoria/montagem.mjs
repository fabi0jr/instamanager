#!/usr/bin/env node
// Montagem com o Gemini: `preparar` reduz as referências e escreve o pedido; `receber` vira a imagem do Gemini numa versão 1080×1350.
// Uso: node assessoria/montagem.mjs preparar <pedido.json>   |   node assessoria/montagem.mjs receber <pasta-da-montagem> <arquivo>
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dentroDe } from './caminhos.mjs';
import { pastaSaida } from './gerar.mjs';
import { ACEITOS, sondaImagem } from './imagem.mjs';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MAX_REF = 1536; // lado maior da referência subida
const MIN_LADO = 800; // abaixo disso é miniatura ou captura de tela
const FIXO = 'Gere uma foto realista, estilo fotojornalismo esportivo, formato vertical 4:5. Mantenha os rostos exatamente como nas fotos de referência das pessoas. Todos vestem a camisa da imagem de referência da camisa: mesmas listras verticais pretas e brancas e o mesmo escudo, mas no modelo moderno de jogo, gola redonda, sem assinatura e sem número. Sem texto, letras ou logotipos inventados na imagem.';
const CAMISA = 'assessoria/fotos/genericas/camisa.jpg';

export class ErroMontagem extends Error {}

const ffmpeg = (args) => execFileSync('/usr/bin/ffmpeg', ['-y', '-v', 'error', ...args], { stdio: ['ignore', 'ignore', 'pipe'] });
const fotosDe = (base) => join(base, 'assessoria/fotos');
const saidasDe = (base) => join(base, 'assessoria/saidas');

export function preparar(pedido, { base = REPO } = {}) {
  const { texto, fotos, camisa = CAMISA, versoes = 3 } = pedido ?? {};
  if (typeof texto !== 'string' || !texto.trim()) throw new ErroMontagem('campo "texto" é obrigatório');
  if (!Array.isArray(fotos) || fotos.length < 1 || fotos.length > 4) throw new ErroMontagem('campo "fotos" precisa ter de 1 a 4 fotos de pessoas');
  if (!Number.isInteger(versoes) || versoes < 1 || versoes > 4) throw new ErroMontagem('campo "versoes" precisa ser um inteiro de 1 a 4');
  const confere = (campo, c) => {
    const abs = typeof c === 'string' ? dentroDe(fotosDe(base), c, base) : null;
    if (!abs) throw new ErroMontagem(`campo "${campo}": só aceita imagem dentro de assessoria/fotos/ (veio "${c}")`);
    if (!existsSync(abs) || !statSync(abs).isFile()) throw new ErroMontagem(`campo "${campo}": arquivo não existe: ${c}`);
    return abs;
  };
  const origens = [...fotos.map((f, i) => confere(`fotos[${i}]`, f)), confere('camisa', camisa)]; // tudo conferido antes de criar a pasta
  origens.forEach((o, i) => {
    const s = sondaImagem(o);
    const campo = i < fotos.length ? `fotos[${i}]` : 'camisa';
    if (!s) throw new ErroMontagem(`campo "${campo}": o arquivo não é uma imagem`);
    if (!ACEITOS.includes(s.codec)) throw new ErroMontagem(`campo "${campo}": só aceito imagem parada JPEG, PNG ou WebP (veio ${s.codec})`);
  });
  const pasta = pastaSaida('montagem', saidasDe(base));
  try {
    const nomes = [...fotos.map((_, i) => `ref-${i + 1}.jpg`), 'camisa.jpg'];
    origens.forEach((o, i) => ffmpeg(['-i', o, '-vf', `scale='min(${MAX_REF},iw)':'min(${MAX_REF},ih)':force_original_aspect_ratio=decrease`, '-frames:v', '1', '-update', '1', '-q:v', '2', join(pasta, nomes[i])]));
    writeFileSync(join(pasta, 'pedido.txt'), `${texto.trim()}\n\n${FIXO}\n`);
  } catch (e) {
    rmSync(pasta, { recursive: true, force: true });
    throw new ErroMontagem(`não consegui reduzir as referências (arquivo não é imagem?): ${String(e.stderr ?? e.message).trim().split('\n')[0]}`);
  }
  return { pasta, referencias: fotos.map((_, i) => join(pasta, `ref-${i + 1}.jpg`)), pedido: join(pasta, 'pedido.txt'), versoes };
}

export function receber(pasta, arquivo, { base = REPO } = {}) {
  const dir = dentroDe(saidasDe(base), pasta, base);
  if (!dir || !existsSync(dir) || !statSync(dir).isDirectory()) throw new ErroMontagem(`a pasta da montagem precisa existir dentro de assessoria/saidas/ (veio "${pasta}")`);
  const arq = resolve(String(arquivo)); // relativo vale a partir de onde o comando roda
  if (!existsSync(arq) || !statSync(arq).isFile()) throw new ErroMontagem(`arquivo não existe: ${arquivo}`);
  if (statSync(arq).size === 0) throw new ErroMontagem(`arquivo vazio: ${arquivo}`);
  const s = sondaImagem(arq);
  if (!s) throw new ErroMontagem(`o arquivo não é uma imagem (HTML de erro?): ${arquivo}`);
  if (!ACEITOS.includes(s.codec)) throw new ErroMontagem(`só aceito JPEG, PNG ou WebP (veio ${s.codec})`);
  if (Math.min(s.w, s.h) < MIN_LADO) throw new ErroMontagem(`imagem pequena demais (${s.w}×${s.h}, mínimo ${MIN_LADO} px no lado menor): parece miniatura ou captura de tela`);
  const n = Math.max(0, ...readdirSync(dir).map((f) => +(/^v(\d+)\.jpg$/.exec(f)?.[1] ?? 0))) + 1;
  const versao = join(dir, `v${n}.jpg`);
  try {
    ffmpeg(['-i', arq, '-vf', 'scale=1080:1350:force_original_aspect_ratio=increase,crop=1080:1350', '-frames:v', '1', '-update', '1', '-q:v', '2', versao]);
  } catch (e) {
    rmSync(versao, { force: true });
    throw new ErroMontagem(`não consegui converter a imagem: ${String(e.stderr ?? e.message).trim().split('\n')[0]}`);
  }
  return { versao };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [cmd, a, b] = process.argv.slice(2);
  try {
    let r;
    if (cmd === 'preparar' && a) r = preparar(JSON.parse(readFileSync(resolve(a), 'utf8')));
    else if (cmd === 'receber' && a && b) r = receber(a, b);
    else throw new ErroMontagem('uso: montagem.mjs preparar <pedido.json> | receber <pasta-da-montagem> <arquivo>');
    console.log(JSON.stringify(r, null, 2));
  } catch (e) {
    console.error(e instanceof ErroMontagem ? `Erro: ${e.message}` : e.message);
    process.exit(1);
  }
}
