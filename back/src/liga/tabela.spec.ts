import { calcularTabela, type JogoFechado, type JogoTabela } from './tabela.js';

const clubes = [
  { id: 'a', nome: 'Alfa' },
  { id: 'b', nome: 'Beta' },
  { id: 'c', nome: 'Gama' },
  { id: 'd', nome: 'Delta' },
];
const j = (rodada: number, mandanteId: string, golsMandante: number, golsVisitante: number, visitanteId: string): JogoFechado => ({ rodada, mandanteId, visitanteId, golsMandante, golsVisitante });
const linha = (t: ReturnType<typeof calcularTabela>, id: string) => t.find((l) => l.clubeId === id)!;

describe('calcularTabela', () => {
  it('vitória vale 3, empate 1, derrota 0; contadores e saldo', () => {
    const t = calcularTabela(clubes, [j(1, 'a', 2, 0, 'b'), j(1, 'c', 1, 1, 'd')]);
    expect(linha(t, 'a')).toMatchObject({ P: 3, J: 1, V: 1, E: 0, D: 0, GP: 2, GC: 0, SG: 2, posicao: 1, ultimos: ['V'] });
    expect(linha(t, 'b')).toMatchObject({ P: 0, J: 1, V: 0, D: 1, GP: 0, GC: 2, SG: -2, ultimos: ['D'] });
    expect(linha(t, 'c')).toMatchObject({ P: 1, E: 1 });
    expect(linha(t, 'd')).toMatchObject({ P: 1, E: 1 });
  });

  it('sem jogos: todos zerados, ordem por nome', () => {
    const t = calcularTabela(clubes, []);
    expect(t.map((l) => l.clubeId)).toEqual(['a', 'b', 'd', 'c']); // Alfa, Beta, Delta, Gama
    expect(t.map((l) => l.posicao)).toEqual([1, 2, 3, 4]);
    expect(t[0]).toMatchObject({ P: 0, J: 0, ultimos: [] });
  });

  it('desempate: vitórias, depois saldo, depois gols pró, depois nome', () => {
    // todos com 3 pontos em cada cenário, isolando um critério por vez
    // vitórias: x vence 1 (3 pts); y empata 3 (3 pts)
    const cs = [
      { id: 'x', nome: 'Zeta' },
      { id: 'y', nome: 'Alfa' },
      { id: 'p', nome: 'P' },
      { id: 'q', nome: 'Q' },
      { id: 'r', nome: 'R' },
    ];
    const t1 = calcularTabela(cs, [j(1, 'x', 1, 0, 'p'), j(2, 'y', 0, 0, 'p'), j(3, 'y', 0, 0, 'q'), j(4, 'y', 0, 0, 'r')]);
    expect(t1[0].clubeId).toBe('x'); // mais vitórias, mesmo com nome pior
    expect(t1[1].clubeId).toBe('y');
    // saldo
    const t2 = calcularTabela(clubes, [j(1, 'a', 1, 0, 'c'), j(1, 'b', 3, 0, 'd')]);
    expect(t2.slice(0, 2).map((l) => l.clubeId)).toEqual(['b', 'a']);
    // gols pró (mesmo saldo +1)
    const t3 = calcularTabela(clubes, [j(1, 'a', 1, 0, 'c'), j(1, 'b', 4, 3, 'd')]);
    expect(t3.slice(0, 2).map((l) => l.clubeId)).toEqual(['b', 'a']);
    // nome
    const t4 = calcularTabela(clubes, [j(1, 'c', 1, 0, 'a'), j(1, 'b', 1, 0, 'd')]);
    expect(t4.slice(0, 2).map((l) => l.clubeId)).toEqual(['b', 'c']); // Beta antes de Gama
  });

  it('jogo com clube desconhecido não quebra: conta só para o clube conhecido', () => {
    const t = calcularTabela(clubes, [j(1, 'a', 1, 0, 'zzz')]);
    expect(linha(t, 'a')).toMatchObject({ J: 1, V: 1 });
    expect(t).toHaveLength(4);
  });

  it('ultimos traz no máximo 5, do mais recente ao mais antigo', () => {
    const jogos = [j(1, 'a', 1, 0, 'b'), j(2, 'a', 0, 1, 'b'), j(3, 'a', 1, 1, 'b'), j(4, 'a', 2, 0, 'b'), j(5, 'a', 3, 0, 'b'), j(6, 'a', 0, 5, 'b'), j(7, 'b', 0, 0, 'a')];
    expect(linha(calcularTabela(clubes, jogos), 'a').ultimos).toEqual(['E', 'D', 'V', 'V', 'E']);
    // ordem de chegada dos jogos não importa
    expect(linha(calcularTabela(clubes, [...jogos].reverse()), 'a').ultimos).toEqual(['E', 'D', 'V', 'V', 'E']);
  });

  it('jogo agendado (sem placar) não conta: nem jogo, nem ponto, nem últimos', () => {
    const agendado: JogoTabela = { rodada: 2, mandanteId: 'a', visitanteId: 'b', golsMandante: null, golsVisitante: null };
    const t = calcularTabela(clubes, [j(1, 'a', 2, 0, 'b'), agendado]);
    expect(linha(t, 'a')).toMatchObject({ P: 3, J: 1, ultimos: ['V'] });
    expect(linha(t, 'b')).toMatchObject({ P: 0, J: 1, ultimos: ['D'] });
  });
});
