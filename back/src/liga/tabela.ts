export type JogoFechado = { rodada: number; mandanteId: string; visitanteId: string; golsMandante: number; golsVisitante: number };
export type Resultado = 'V' | 'E' | 'D';
export type Linha = { clubeId: string; nome: string; posicao: number; P: number; J: number; V: number; E: number; D: number; GP: number; GC: number; SG: number; ultimos: Resultado[] };

/** Quem chama passa só jogos de rodadas fechadas. Vitória 3, empate 1; desempate: vitórias, saldo, gols pró, nome. */
export function calcularTabela(clubes: { id: string; nome: string }[], jogos: JogoFechado[]): Linha[] {
  const por = new Map(clubes.map((c) => [c.id, { clubeId: c.id, nome: c.nome, posicao: 0, P: 0, J: 0, V: 0, E: 0, D: 0, GP: 0, GC: 0, SG: 0, ultimos: [] as Resultado[] }]));
  // do mais recente ao mais antigo: `ultimos` já nasce na ordem pedida
  for (const g of [...jogos].sort((a, b) => b.rodada - a.rodada)) {
    for (const [id, pro, contra] of [[g.mandanteId, g.golsMandante, g.golsVisitante], [g.visitanteId, g.golsVisitante, g.golsMandante]] as const) {
      const l = por.get(id);
      if (!l) continue;
      const r: Resultado = pro > contra ? 'V' : pro === contra ? 'E' : 'D';
      l.J++;
      l[r]++;
      l.P += r === 'V' ? 3 : r === 'E' ? 1 : 0;
      l.GP += pro;
      l.GC += contra;
      l.SG = l.GP - l.GC;
      if (l.ultimos.length < 5) l.ultimos.push(r);
    }
  }
  const t = [...por.values()].sort((a, b) => b.P - a.P || b.V - a.V || b.SG - a.SG || b.GP - a.GP || a.nome.localeCompare(b.nome, 'pt-BR'));
  t.forEach((l, i) => (l.posicao = i + 1));
  return t;
}
