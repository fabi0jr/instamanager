import type { JogoFechado, Linha } from '../liga/tabela.js';
import { FRASES, type Categoria } from './frases.js';

export type Tecnico = { id: string; nome: string };
export type EntradaResumo = {
  numero: number;
  jogos: JogoFechado[]; // só os jogos desta rodada
  antes: Linha[]; // tabela sem esta rodada
  depois: Linha[]; // tabela com esta rodada
  tecnicos: Record<string, Tecnico>; // por clubeId
  rei?: { nome: string; pontos: number } | null; // líder do bolão da rodada
};
type Evento = { categoria: Categoria; clube?: string; vars: Record<string, string | number> };

const MAX_TEXTO = 500;
const MAX_EVENTOS = 5; // + a abertura = até 6 frases
const MIN_FRASES = 3;

/**
 * Monta o resumo da rodada com frases prontas (frases.ts). `sortear` devolve [0,1) e é injetável para o teste.
 * Cada frase vai numa linha. `citados` são os técnicos que aparecem pelo nome no texto.
 */
export function montarResumo(r: EntradaResumo, sortear: () => number = Math.random): { texto: string; citados: string[] } {
  const nome = (id: string) => r.depois.find((l) => l.clubeId === id)?.nome ?? id;
  const eventos = detectar(r, nome);
  // goleada e lanterna sempre entram; o resto é sorteado e limitado
  const fixos = eventos.filter((e) => e.categoria === 'goleada' || e.categoria === 'lanterna');
  const resto = embaralhar(eventos.filter((e) => !fixos.includes(e)), sortear);
  const escolhidos = [...fixos, ...resto].slice(0, MAX_EVENTOS);

  const usadas = new Set<string>();
  const linhas: string[] = [];
  const citados = new Set<string>();
  const escolher = (cat: Categoria, vars: Record<string, string | number>, tecnico?: Tecnico) => {
    const grupo = FRASES[cat];
    const pool = (tecnico ? grupo.com : grupo.sem).filter((f) => !usadas.has(f));
    const modelo = pool[Math.min(pool.length - 1, Math.floor(sortear() * pool.length))] ?? (grupo.sem.find((f) => !usadas.has(f)) as string);
    if (!modelo) return;
    usadas.add(modelo);
    if (tecnico && grupo.com.includes(modelo)) citados.add(tecnico.id);
    linhas.push(preencher(modelo, { ...vars, ...(tecnico ? { tecnico: tecnico.nome } : {}) }));
  };

  escolher('abertura', { n: r.numero });
  for (const e of escolhidos) escolher(e.categoria, e.vars, e.clube ? r.tecnicos[e.clube] : undefined);
  if (r.rei) escolher('reiBolao', { rei: r.rei.nome, pontos: r.rei.pontos });
  while (linhas.length < MIN_FRASES && FRASES.geral.sem.some((f) => !usadas.has(f))) escolher('geral', {});
  // 500 caracteres: tira de trás para frente (a abertura fica); os citados acompanham o que sobrou no texto
  while (linhas.join('\n').length > MAX_TEXTO && linhas.length > 1) linhas.pop();
  const texto = linhas.join('\n');
  const dentro = [...citados].filter((id) => Object.values(r.tecnicos).some((t) => t.id === id && texto.includes(t.nome)));
  return { texto, citados: dentro };
}

function detectar(r: EntradaResumo, nome: (id: string) => string): Evento[] {
  const eventos: Evento[] = [];
  const placar = (g: JogoFechado) => `${Math.max(g.golsMandante, g.golsVisitante)} a ${Math.min(g.golsMandante, g.golsVisitante)}`;
  const resultado = (g: JogoFechado) => {
    const m = g.golsMandante - g.golsVisitante;
    return m === 0 ? null : m > 0 ? { vencedor: g.mandanteId, perdedor: g.visitanteId, saldo: m } : { vencedor: g.visitanteId, perdedor: g.mandanteId, saldo: -m };
  };
  const decididos = r.jogos.map((g) => ({ g, res: resultado(g) })).filter((x): x is { g: JogoFechado; res: NonNullable<ReturnType<typeof resultado>> } => x.res !== null);

  // maior goleada (saldo ≥ 3): zoa quem tomou
  const goleada = [...decididos].sort((a, b) => b.res.saldo - a.res.saldo)[0];
  if (goleada && goleada.res.saldo >= 3) eventos.push({ categoria: 'goleada', clube: goleada.res.perdedor, vars: { clube: nome(goleada.res.perdedor), outro: nome(goleada.res.vencedor), placar: placar(goleada.g) } });

  // um derrotado (fora o da goleada)
  const outros = decididos.filter((x) => x !== goleada || goleada.res.saldo < 3);
  if (outros.length) {
    const d = outros[0];
    eventos.push({ categoria: 'derrota', clube: d.res.perdedor, vars: { clube: nome(d.res.perdedor), outro: nome(d.res.vencedor), placar: placar(d.g) } });
  }

  // na 1ª rodada a tabela anterior é só a ordem por nome: lanterna, queda e Z4 seriam invenção
  const temHistorico = r.antes.some((l) => l.J > 0);
  const ultimoA = r.antes.at(-1);
  const ultimoD = r.depois.at(-1);
  if (temHistorico && ultimoD && ultimoA && ultimoD.clubeId !== ultimoA.clubeId && ultimoD.J > 0)
    eventos.push({ categoria: 'lanterna', clube: ultimoD.clubeId, vars: { clube: ultimoD.nome, pontos: ultimoD.P } });

  const posAntes = new Map(r.antes.map((l) => [l.clubeId, l.posicao]));
  const quedas = r.depois.map((l) => ({ l, n: l.posicao - (posAntes.get(l.clubeId) ?? l.posicao) })).filter((x) => x.n >= 3).sort((a, b) => b.n - a.n);
  if (temHistorico && quedas[0]) eventos.push({ categoria: 'queda', clube: quedas[0].l.clubeId, vars: { clube: quedas[0].l.nome, n: quedas[0].n, pos: quedas[0].l.posicao } });

  const [p1, p2] = r.depois;
  if (p1 && p2 && p1.J > 0 && p1.P > p2.P) eventos.push({ categoria: 'lider', clube: p1.clubeId, vars: { clube: p1.nome, pontos: p1.P } });

  const jogaram = new Set(r.jogos.flatMap((g) => [g.mandanteId, g.visitanteId]));
  const seq = r.depois.filter((l) => jogaram.has(l.clubeId)).map((l) => ({ l, n: l.ultimos.findIndex((x) => x !== 'D') })).map((x) => ({ l: x.l, n: x.n === -1 ? x.l.ultimos.length : x.n })).filter((x) => x.n >= 3).sort((a, b) => b.n - a.n);
  if (seq[0]) eventos.push({ categoria: 'sequencia', clube: seq[0].l.clubeId, vars: { clube: seq[0].l.nome, n: seq[0].n } });

  const total = r.depois.length;
  if (temHistorico && total >= 12) {
    const entrou = r.depois.find((l) => l.posicao > total - 4 && (posAntes.get(l.clubeId) ?? 0) <= total - 4 && jogaram.has(l.clubeId));
    if (entrou) eventos.push({ categoria: 'z4', clube: entrou.clubeId, vars: { clube: entrou.nome, pos: entrou.posicao } });
  }

  // fim de jejum: venceu agora e, antes, estava há ≥ 3 jogos sem vencer
  const antesPor = new Map(r.antes.map((l) => [l.clubeId, l]));
  for (const x of decididos) {
    const a = antesPor.get(x.res.vencedor);
    const semVencer = a ? (a.ultimos.findIndex((u) => u === 'V') === -1 ? a.ultimos.length : a.ultimos.findIndex((u) => u === 'V')) : 0;
    if (semVencer >= 3) {
      eventos.push({ categoria: 'jejum', clube: x.res.vencedor, vars: { clube: nome(x.res.vencedor), n: semVencer } });
      break;
    }
  }

  const empates = r.jogos.length - decididos.length;
  if (empates >= 2) eventos.push({ categoria: 'empates', vars: { n: empates } });
  return eventos;
}

export function preencher(modelo: string, vars: Record<string, string | number>) {
  return modelo.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''));
}

export function embaralhar<T>(lista: T[], sortear: () => number): T[] {
  const a = [...lista];
  for (let i = a.length - 1; i > 0; i--) {
    const k = Math.floor(sortear() * (i + 1));
    [a[i], a[k]] = [a[k], a[i]];
  }
  return a;
}

export type JogoCopaResumo = { mandante: { id: string; nome: string }; visitante: { id: string; nome: string }; golsMandante: number; golsVisitante: number; penaltisMandante: number | null; penaltisVisitante: number | null };

/** Resumo de uma fase fechada da Copa: abertura + até 5 eliminações (jogos sorteados), 500 caracteres. */
export function montarResumoCopa(fase: string, jogos: JogoCopaResumo[], tecnicos: Record<string, Tecnico>, sortear: () => number = Math.random, rei?: { nome: string; pontos: number } | null): { texto: string; citados: string[] } {
  const usadas = new Set<string>();
  const citados = new Set<string>();
  const linha = (cat: Categoria, vars: Record<string, string | number>, tecnico?: Tecnico) => {
    const g = FRASES[cat];
    const pool = (tecnico ? g.com : g.sem).filter((f) => !usadas.has(f));
    const modelo = pool[Math.floor(sortear() * pool.length)] ?? g.sem.find((f) => !usadas.has(f));
    if (!modelo) return null;
    usadas.add(modelo);
    if (tecnico && g.com.includes(modelo)) citados.add(tecnico.id);
    return preencher(modelo, { ...vars, ...(tecnico ? { tecnico: tecnico.nome } : {}) });
  };
  const linhas = [linha('copaAbertura', { fase })];
  for (const j of embaralhar(jogos, sortear).slice(0, MAX_EVENTOS)) {
    const pen = j.penaltisMandante !== null && j.penaltisVisitante !== null;
    const [a, b] = pen ? [j.penaltisMandante!, j.penaltisVisitante!] : [j.golsMandante, j.golsVisitante];
    const [venc, perd] = a > b ? [j.mandante, j.visitante] : [j.visitante, j.mandante];
    const placar = `${Math.max(a, b)} a ${Math.min(a, b)}`;
    linhas.push(linha(pen ? 'copaPenaltis' : 'copaEliminado', { clube: perd.nome, outro: venc.nome, placar, fase }, tecnicos[perd.id]));
  }
  if (rei) linhas.push(linha('reiBolao', { rei: rei.nome, pontos: rei.pontos }));
  const l = linhas.filter((x): x is string => x !== null);
  while (l.join('\n').length > MAX_TEXTO && l.length > 1) l.pop();
  const texto = l.join('\n');
  return { texto, citados: [...citados].filter((id) => Object.values(tecnicos).some((t) => t.id === id && texto.includes(t.nome))) };
}
