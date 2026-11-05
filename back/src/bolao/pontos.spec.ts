import { pontosPalpite } from './pontos.js';

const p = (m: number, v: number, classificadoId?: string) => ({ golsMandante: m, golsVisitante: v, classificadoId });
const r = (m: number | null, v: number | null) => ({ golsMandante: m, golsVisitante: v });

describe('pontosPalpite', () => {
  it('placar exato 3 (inclusive empate exato)', () => {
    expect(pontosPalpite(p(2, 1), r(2, 1))).toEqual({ pontos: 3, exato: true });
    expect(pontosPalpite(p(0, 0), r(0, 0))).toEqual({ pontos: 3, exato: true });
  });
  it('vencedor certo 1; empate certo com outro placar 1', () => {
    expect(pontosPalpite(p(3, 0), r(2, 1))).toEqual({ pontos: 1, exato: false });
    expect(pontosPalpite(p(0, 2), r(1, 3))).toEqual({ pontos: 1, exato: false });
    expect(pontosPalpite(p(1, 1), r(2, 2))).toEqual({ pontos: 1, exato: false });
  });
  it('errado 0; jogo sem placar 0', () => {
    expect(pontosPalpite(p(2, 1), r(0, 1))).toEqual({ pontos: 0, exato: false });
    expect(pontosPalpite(p(1, 1), r(1, 0))).toEqual({ pontos: 0, exato: false });
    expect(pontosPalpite(p(1, 0), r(null, null))).toEqual({ pontos: 0, exato: false });
  });
  it('Copa: +1 por quem passa, somado ao placar; errou quem passa, só o placar', () => {
    expect(pontosPalpite(p(2, 1, 'a'), r(2, 1), { vencedorId: 'a' })).toEqual({ pontos: 4, exato: true });
    expect(pontosPalpite(p(1, 0, 'a'), r(3, 1), { vencedorId: 'a' })).toEqual({ pontos: 2, exato: false });
    expect(pontosPalpite(p(2, 1, 'a'), r(2, 1), { vencedorId: 'b' })).toEqual({ pontos: 3, exato: true });
  });
  it('Copa: palpite de empate acertando o empate e quem passa nos pênaltis: 1 + 1 (ou 3 + 1 se exato)', () => {
    expect(pontosPalpite(p(1, 1, 'b'), r(0, 0), { vencedorId: 'b' })).toEqual({ pontos: 2, exato: false });
    expect(pontosPalpite(p(1, 1, 'b'), r(1, 1), { vencedorId: 'b' })).toEqual({ pontos: 4, exato: true });
    expect(pontosPalpite(p(1, 1, 'a'), r(1, 1), { vencedorId: 'b' })).toEqual({ pontos: 3, exato: true });
  });
  it('Copa: palpite de empate mas o jogo teve vencedor no tempo normal: só quem passa pode pontuar', () => {
    expect(pontosPalpite(p(1, 1, 'a'), r(2, 0), { vencedorId: 'a' })).toEqual({ pontos: 1, exato: false });
  });
});
