import { goleada, invicto5, primeiraVitoria, type JogoDoTecnico } from './regras.js';

const j = (rodada: number | null, pro: number, contra: number, penaltis = false): JogoDoTecnico => ({ data: new Date(2026, 0, rodada ?? 1), rodada, golsPro: pro, golsContra: contra, penaltis });
const sequencia = (rs: ('V' | 'E' | 'D')[]) => rs.map((r, i) => j(i + 1, r === 'V' ? 1 : r === 'E' ? 1 : 0, r === 'V' ? 0 : r === 'E' ? 1 : 1));

describe('primeiraVitoria', () => {
  it('só com vitória', () => {
    expect(primeiraVitoria([j(1, 0, 0), j(2, 0, 1)])).toBe(false);
    expect(primeiraVitoria([j(1, 0, 1), j(2, 2, 1)])).toBe(true);
  });
  it('empate nos pênaltis da Copa não é vitória', () => {
    expect(primeiraVitoria([j(null, 1, 1, true)])).toBe(false);
  });
});

describe('goleada', () => {
  it('3×0 sim; 3×1 não; derrota por 3 não conta', () => {
    expect(goleada([j(1, 3, 0)])).toBe(true);
    expect(goleada([j(1, 3, 1)])).toBe(false);
    expect(goleada([j(1, 0, 3)])).toBe(false);
  });
});

describe('invicto5', () => {
  it('V,E,V,E,V sim', () => expect(invicto5(sequencia(['V', 'E', 'V', 'E', 'V']))).toBe(true));
  it('V,V,D,V,V,V não (a derrota quebra a sequência)', () => expect(invicto5(sequencia(['V', 'V', 'D', 'V', 'V', 'V']))).toBe(false));
  it('acha a sequência no meio e ordena por rodada', () => {
    const jogos = sequencia(['D', 'V', 'V', 'E', 'V', 'V', 'D']);
    expect(invicto5([...jogos].reverse())).toBe(true);
  });
  it('a Copa não entra na conta', () => {
    expect(invicto5([...sequencia(['V', 'V', 'V', 'V']), j(null, 1, 0)])).toBe(false);
  });
});
