import { achaEliminadoJogando, ladoVencedor, type PlacarCopa } from './copa.js';

const p = (gm: number | null, gv: number | null, pm: number | null = null, pv: number | null = null): PlacarCopa => ({ golsMandante: gm, golsVisitante: gv, penaltisMandante: pm, penaltisVisitante: pv });
const jogo = (m: string, v: string, placar: PlacarCopa) => ({ mandanteId: m, visitanteId: v, ...placar });

describe('ladoVencedor', () => {
  it('pelo placar; no empate, pelos pênaltis; sem placar ou sem decisão, null', () => {
    expect(ladoVencedor(p(2, 1))).toBe('M');
    expect(ladoVencedor(p(0, 1))).toBe('V');
    expect(ladoVencedor(p(1, 1, 3, 4))).toBe('V');
    expect(ladoVencedor(p(1, 1, 5, 4))).toBe('M');
    expect(ladoVencedor(p(1, 1))).toBeNull();
    expect(ladoVencedor(p(1, 1, 4, 4))).toBeNull();
    expect(ladoVencedor(p(null, null))).toBeNull();
  });
});

describe('achaEliminadoJogando', () => {
  const f1 = { jogos: [jogo('a', 'b', p(1, 0)), jogo('c', 'd', p(1, 1, 3, 4))] }; // b e c caem
  it('acha quem perdeu e aparece numa fase de ordem maior', () => {
    expect(achaEliminadoJogando([f1, { jogos: [jogo('a', 'c', p(null, null))] }])).toBe('c');
    expect(achaEliminadoJogando([f1, { jogos: [jogo('a', 'd', p(null, null))] }])).toBeNull();
  });
  it('jogo sem placar não elimina ninguém', () => {
    expect(achaEliminadoJogando([{ jogos: [jogo('a', 'b', p(null, null))] }, { jogos: [jogo('b', 'a', p(null, null))] }])).toBeNull();
  });
});
