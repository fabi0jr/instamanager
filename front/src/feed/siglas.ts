// Sigla de 3–4 letras dos 20 clubes (por slug); clube fora da lista cai nas 3 primeiras letras do slug
const SIGLAS: Record<string, string> = {
  palmeiras: 'PAL', santos: 'SAN', 'sao-paulo': 'SPFC', corinthians: 'COR', flamengo: 'FLA', fluminense: 'FLU', botafogo: 'BOT',
  vasco: 'VAS', gremio: 'GRE', internacional: 'INT', 'atletico-mg': 'CAM', cruzeiro: 'CRU', bahia: 'BAH', vitoria: 'VIT',
  'athletico-pr': 'CAP', coritiba: 'CFC', chapecoense: 'CHA', mirassol: 'MIR', 'red-bull-bragantino': 'RBB', remo: 'REM',
};
export const sigla = (id: string) => SIGLAS[id] ?? id.slice(0, 3).toUpperCase();
