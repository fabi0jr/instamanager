export type PlacarCopa = { golsMandante: number | null; golsVisitante: number | null; penaltisMandante: number | null; penaltisVisitante: number | null };

/** Quem passou: 'M' (mandante), 'V' (visitante) ou null (sem placar, ou empate sem pênaltis decididos). */
export function ladoVencedor(j: PlacarCopa): 'M' | 'V' | null {
  if (j.golsMandante === null || j.golsVisitante === null) return null;
  if (j.golsMandante !== j.golsVisitante) return j.golsMandante > j.golsVisitante ? 'M' : 'V';
  if (j.penaltisMandante === null || j.penaltisVisitante === null || j.penaltisMandante === j.penaltisVisitante) return null;
  return j.penaltisMandante > j.penaltisVisitante ? 'M' : 'V';
}

/** Primeiro clube de `jogosPorFase` (já por ordem) que joga uma fase depois de ter perdido numa anterior. */
export function achaEliminadoJogando(fases: { jogos: (PlacarCopa & { mandanteId: string; visitanteId: string })[] }[]): string | null {
  const eliminados = new Set<string>();
  for (const f of fases) {
    for (const j of f.jogos) for (const id of [j.mandanteId, j.visitanteId]) if (eliminados.has(id)) return id;
    for (const j of f.jogos) {
      const l = ladoVencedor(j);
      if (l) eliminados.add(l === 'M' ? j.visitanteId : j.mandanteId);
    }
  }
  return null;
}
