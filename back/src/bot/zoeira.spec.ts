import { calcularTabela, type JogoFechado } from '../liga/tabela.js';
import { FRASES, VARIAVEIS, type Categoria } from './frases.js';
import { montarResumo } from './zoeira.js';

const clubes = Array.from({ length: 20 }, (_, i) => ({ id: `c${i + 1}`, nome: `Clube ${String.fromCharCode(65 + i)}` }));
const j = (rodada: number, m: string, gm: number, gv: number, v: string): JogoFechado => ({ rodada, mandanteId: m, visitanteId: v, golsMandante: gm, golsVisitante: gv });
const tecnicos = Object.fromEntries(clubes.map((c, i) => [c.id, { id: `u${i + 1}`, nome: `Treinador ${i + 1}` }]));
// sorteio fixo: sempre o primeiro da lista; e um gerador sequencial para variar sem Math.random
const fixo = () => 0;
const seq = (passo: number) => { let x = 0.13; return () => (x = (x + passo) % 1); };

/** Rodada 2: c1 faz 5x0 em c2 (goleada), c20 perde de novo e vira o lanterna (antes era c7), c3 empata com c4. */
function cenario(comTecnicos = true) {
  const r1 = [j(1, 'c2', 3, 0, 'c7'), j(1, 'c19', 1, 0, 'c20'), j(1, 'c5', 1, 0, 'c6')];
  const r2 = [j(2, 'c1', 5, 0, 'c2'), j(2, 'c19', 2, 0, 'c20'), j(2, 'c3', 1, 1, 'c4')];
  return { numero: 2, jogos: r2, antes: calcularTabela(clubes, r1), depois: calcularTabela(clubes, [...r1, ...r2]), tecnicos: comTecnicos ? tecnicos : {} };
}

describe('montarResumo', () => {
  it('com sortear fixo o texto é determinístico', () => {
    expect(montarResumo(cenario(), fixo)).toEqual(montarResumo(cenario(), fixo));
    expect(montarResumo(cenario(), seq(0.37)).texto).toBe(montarResumo(cenario(), seq(0.37)).texto);
  });

  it('cita o derrotado da maior goleada e o novo lanterna (nome e userId)', () => {
    for (const s of [fixo, seq(0.37), seq(0.61), () => 0.999]) {
      const r = montarResumo(cenario(), s);
      expect(r.texto).toContain('Clube B'); // c2 tomou 5x0
      expect(r.texto).toContain('Clube T'); // c20 é o novo lanterna
      expect(r.texto).toContain('Treinador 2');
      expect(r.texto).toContain('Treinador 20');
      expect(r.citados).toEqual(expect.arrayContaining(['u2', 'u20']));
      expect(new Set(r.citados).size).toBe(r.citados.length);
    }
  });

  it('clube sem técnico entra no texto mas não nos citados', () => {
    const r = montarResumo(cenario(false), fixo);
    expect(r.texto).toContain('Clube B');
    expect(r.citados).toEqual([]);
    expect(r.texto).not.toMatch(/\{\w+\}/);
  });

  it('junta de 3 a 6 frases, nunca repete e nunca passa de 500 caracteres', () => {
    for (let k = 1; k <= 60; k++) {
      const r = montarResumo(cenario(), seq(k / 61));
      const frases = r.texto.split('\n');
      expect(frases.length).toBeGreaterThanOrEqual(3);
      expect(frases.length).toBeLessThanOrEqual(6);
      expect(new Set(frases).size).toBe(frases.length);
      expect(r.texto.length).toBeLessThanOrEqual(500);
      expect(r.texto).not.toMatch(/\{\w+\}/);
    }
  });

  it('rodada só com empates não quebra', () => {
    const jogos = [j(1, 'c1', 1, 1, 'c2'), j(1, 'c3', 0, 0, 'c4'), j(1, 'c5', 2, 2, 'c6')];
    const r = montarResumo({ numero: 1, jogos, antes: calcularTabela(clubes, []), depois: calcularTabela(clubes, jogos), tecnicos }, seq(0.29));
    expect(r.texto.split('\n').length).toBeGreaterThanOrEqual(3);
    expect(r.texto).toMatch(/3 empates|empates/);
    expect(r.texto).not.toMatch(/\{\w+\}/);
  });

  it('rodada sem jogos nem tabela anterior ainda devolve um texto', () => {
    const r = montarResumo({ numero: 1, jogos: [], antes: calcularTabela(clubes, []), depois: calcularTabela(clubes, []), tecnicos }, fixo);
    expect(r.texto.split('\n').length).toBeGreaterThanOrEqual(3);
    expect(r.citados).toEqual([]);
  });

  it('detecta líder isolado, sequência de derrotas, queda, Z4 e fim de jejum', () => {
    // c1 lidera sozinho; c2 perde 3 seguidas; c20 vence depois de 3 sem vencer
    const antesJ = [j(1, 'c1', 1, 0, 'c9'), j(2, 'c1', 1, 0, 'c10'), j(3, 'c9', 1, 0, 'c2'), j(4, 'c10', 1, 0, 'c2'), j(5, 'c11', 1, 0, 'c2'), j(1, 'c20', 0, 1, 'c12'), j(2, 'c20', 0, 1, 'c13'), j(3, 'c20', 0, 1, 'c14')];
    const rodada = [j(6, 'c1', 2, 0, 'c15'), j(6, 'c20', 1, 0, 'c16'), j(6, 'c12', 3, 0, 'c2')];
    const antes = calcularTabela(clubes, antesJ);
    const depois = calcularTabela(clubes, [...antesJ, ...rodada]);
    const textos = new Set<string>();
    for (let k = 1; k <= 40; k++) montarResumo({ numero: 6, jogos: rodada, antes, depois, tecnicos }, seq(k / 41)).texto.split('\n').forEach((f) => textos.add(f));
    const todo = [...textos].join('\n');
    expect(todo).toContain('Clube A'); // líder
    expect(todo).toContain('Clube B'); // 4 derrotas seguidas
    expect(todo).toMatch(/4 derrotas seguidas/);
    expect(todo).toContain('Clube T'); // fim de jejum
  });
});

describe('montarResumo na primeira rodada (antes sem jogos)', () => {
  // o 1º da tabela vazia (ordem por nome) perde de 0 a 3 e "despenca" para o último lugar só porque a tabela estava zerada
  const jogos = [j(1, 'c1', 0, 3, 'c2'), j(1, 'c3', 1, 0, 'c4')];
  const entrada = { numero: 1, jogos, antes: calcularTabela(clubes, []), depois: calcularTabela(clubes, jogos), tecnicos };
  const modelos = (['queda', 'z4', 'lanterna'] as const).flatMap((c) => [...FRASES[c].sem, ...FRASES[c].com]).map((f) => new RegExp(`^${f.replace(/[.*+?^$()|[\]\\]/g, '\\$&').replace(/\{\w+\}/g, '.+')}$`));

  it('não inventa queda, Z4 nem lanterna', () => {
    for (const s of [fixo, () => 0.999, ...[1, 2, 3, 4, 5, 6, 7].map((k) => seq(k / 8))]) {
      const linhas = montarResumo(entrada, s).texto.split('\n');
      for (const l of linhas) for (const m of modelos) expect(l, l).not.toMatch(m);
    }
    expect(montarResumo(entrada, fixo).texto).toContain('Clube B'); // a goleada continua
  });

  it('a partir da 2ª rodada (antes com jogos) os mesmos eventos voltam a valer', () => {
    const antesJ = [j(1, 'c5', 1, 0, 'c6')];
    const e2 = { numero: 2, jogos, antes: calcularTabela(clubes, antesJ), depois: calcularTabela(clubes, [...antesJ, ...jogos.map((x) => ({ ...x, rodada: 2 }))]), tecnicos };
    const visto = new Set<string>();
    for (let k = 1; k <= 40; k++) montarResumo(e2, seq(k / 41)).texto.split('\n').forEach((l) => visto.add(l));
    expect([...visto].some((l) => modelos.some((m) => m.test(l)))).toBe(true);
  });
});

describe('frases.ts', () => {
  const todas = Object.entries(FRASES).flatMap(([cat, g]) => [...g.sem, ...g.com].map((f) => [cat as Categoria, f, g.com.includes(f)] as const));

  it('tem ≥ 40 frases, sem repetição, cada uma com até 120 caracteres modelo', () => {
    expect(todas.length).toBeGreaterThanOrEqual(40);
    expect(new Set(todas.map((t) => t[1])).size).toBe(todas.length);
    for (const [, f] of todas) expect(f.length).toBeLessThanOrEqual(120);
  });

  it('todas as variáveis usadas existem na categoria; "com" usa {tecnico} e "sem" não', () => {
    for (const [cat, f, com] of todas) {
      const usadas = [...f.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
      for (const v of usadas) expect(VARIAVEIS[cat], `${cat}: {${v}} em "${f}"`).toContain(v);
      expect(usadas.includes('tecnico'), `"${f}"`).toBe(com);
    }
  });
});
