import { nivelDe, xpDe } from './xp.js';

describe('xpDe', () => {
  it('soma posts, reações (teto 50 por post), vitórias, empates, placares exatos e selos', () => {
    expect(xpDe({ posts: 2, reacoesPorPost: [60, 3], vitorias: 1, empates: 1, exatos: 1, selos: 1 })).toBe(10 + 53 + 10 + 3 + 5 + 20); // 101
  });
  it('sem histórico vale 0', () => {
    expect(xpDe({ posts: 0, reacoesPorPost: [], vitorias: 0, empates: 0, exatos: 0, selos: 0 })).toBe(0);
  });
});

describe('nivelDe', () => {
  it('99 ainda é Estagiário; 100 já é Auxiliar e o próximo é 300', () => {
    expect(nivelDe(99).nome).toBe('Estagiário');
    expect(nivelDe(100)).toEqual({ xp: 100, nome: 'Auxiliar', min: 100, proximo: 300 });
  });
  it('cada limite abre o seu nível', () => {
    expect([0, 300, 700, 1500].map((x) => nivelDe(x).nome)).toEqual(['Estagiário', 'Técnico', 'Professor', 'Lenda']);
  });
  it('Lenda não tem próximo', () => {
    expect(nivelDe(1500).proximo).toBeNull();
    expect(nivelDe(99999).nome).toBe('Lenda');
  });
});
