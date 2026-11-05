export type Palpite = { golsMandante: number; golsVisitante: number; classificadoId?: string | null };
export type Placar = { golsMandante: number | null; golsVisitante: number | null };

const sinal = (m: number, v: number) => Math.sign(m - v);

/**
 * Placar exato 3; vencedor ou empate certo 1; errado 0. Copa: +1 se acertou quem passa
 * (`classificadoId` do palpite = `vencedorId` do jogo). Jogo sem placar vale 0.
 */
export function pontosPalpite(p: Palpite, jogo: Placar, copa?: { vencedorId: string | null }): { pontos: number; exato: boolean } {
  if (jogo.golsMandante === null || jogo.golsVisitante === null) return { pontos: 0, exato: false };
  const exato = p.golsMandante === jogo.golsMandante && p.golsVisitante === jogo.golsVisitante;
  let pontos = exato ? 3 : sinal(p.golsMandante, p.golsVisitante) === sinal(jogo.golsMandante, jogo.golsVisitante) ? 1 : 0;
  if (copa?.vencedorId && p.classificadoId === copa.vencedorId) pontos += 1;
  return { pontos, exato };
}
