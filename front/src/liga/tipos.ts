export type Resultado = 'V' | 'E' | 'D';
export type Linha = { clubeId: string; nome: string; posicao: number; P: number; J: number; V: number; E: number; D: number; GP: number; GC: number; SG: number; ultimos: Resultado[] };
export type ClubeJogo = { id: string; nome: string; escudoUrl: string };
export type Jogo = { id: string; mandante: ClubeJogo; visitante: ClubeJogo; golsMandante: number; golsVisitante: number };
export type Rodada = { numero: number; fechada: boolean; jogos: Jogo[] };

export const NOME_RESULTADO = { V: 'vitória', E: 'empate', D: 'derrota' } as const;
// a API manda do jogo mais novo ao mais velho; a tela mostra do mais velho (esquerda) ao mais novo
export const ultimosNaTela = (u: Resultado[]) => [...u].reverse();
export const textoUltimos = (u: Resultado[]) => (u.length ? `últimos ${u.length}: ${ultimosNaTela(u).map((r) => NOME_RESULTADO[r]).join(', ')}` : 'sem jogos ainda');
