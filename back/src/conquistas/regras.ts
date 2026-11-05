import type { ConquistaTipo } from '../generated/prisma/client.js';

/** `rodada: null` = jogo da Copa (pênaltis ficam como empate). O chamador só passa jogos de rodada/fase fechada, já separados por clube quando a regra pede. */
export type JogoDoTecnico = { data: Date; rodada: number | null; golsPro: number; golsContra: number; penaltis?: boolean };

export const NOMES: Record<ConquistaTipo, string> = {
  PRIMEIRA_VITORIA: 'Primeira vitória',
  GOLEADA: 'Goleada',
  INVICTO_5: 'Invicto',
  LIDER: 'Líder',
  CAMPEAO_COPA: 'Campeão da Copa',
  REI_BOLAO: 'Rei do bolão',
  PRIMEIRO_STORY: 'Primeiro story',
  COMUNICADOR: 'Comunicador',
};

export const primeiraVitoria = (jogos: JogoDoTecnico[]) => jogos.some((j) => j.golsPro > j.golsContra);

export const goleada = (jogos: JogoDoTecnico[]) => jogos.some((j) => j.golsPro - j.golsContra >= 3);

/** 5 jogos seguidos do Brasileirão (por rodada) sem perder. */
export function invicto5(jogos: JogoDoTecnico[]): boolean {
  let seguidos = 0;
  for (const j of jogos.filter((x) => x.rodada !== null).sort((a, b) => a.rodada! - b.rodada!)) {
    seguidos = j.golsPro >= j.golsContra ? seguidos + 1 : 0;
    if (seguidos >= 5) return true;
  }
  return false;
}
