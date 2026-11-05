export const NIVEIS = [
  { nome: 'Estagiário', min: 0 },
  { nome: 'Auxiliar', min: 100 },
  { nome: 'Técnico', min: 300 },
  { nome: 'Professor', min: 700 },
  { nome: 'Lenda', min: 1500 },
] as const;

export type Historico = { posts: number; reacoesPorPost: number[]; vitorias: number; empates: number; exatos: number; selos: number };

const TETO_REACOES_POR_POST = 50;

/** XP calculado do histórico (nada fica guardado): post 5, reação 1 (até 50 por post), vitória 10, empate 3, placar exato 5, selo 20. */
export function xpDe(h: Historico): number {
  return h.posts * 5 + h.reacoesPorPost.reduce((s, r) => s + Math.min(r, TETO_REACOES_POR_POST), 0) + h.vitorias * 10 + h.empates * 3 + h.exatos * 5 + h.selos * 20;
}

/** `proximo` = XP mínimo do nível seguinte (null na Lenda). */
export function nivelDe(xp: number): { xp: number; nome: string; min: number; proximo: number | null } {
  const i = NIVEIS.findLastIndex((n) => xp >= n.min);
  return { xp, nome: NIVEIS[i].nome, min: NIVEIS[i].min, proximo: NIVEIS[i + 1]?.min ?? null };
}
