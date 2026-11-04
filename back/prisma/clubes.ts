// Série A 2026 (20 clubes). O id é o slug e vira /escudos/<id>.svg.
export const clubes = [
  ['athletico-pr', 'Athletico-PR'],
  ['atletico-mg', 'Atlético-MG'],
  ['bahia', 'Bahia'],
  ['botafogo', 'Botafogo'],
  ['chapecoense', 'Chapecoense'],
  ['corinthians', 'Corinthians'],
  ['coritiba', 'Coritiba'],
  ['cruzeiro', 'Cruzeiro'],
  ['flamengo', 'Flamengo'],
  ['fluminense', 'Fluminense'],
  ['gremio', 'Grêmio'],
  ['internacional', 'Internacional'],
  ['mirassol', 'Mirassol'],
  ['palmeiras', 'Palmeiras'],
  ['red-bull-bragantino', 'Red Bull Bragantino'],
  ['remo', 'Remo'],
  ['santos', 'Santos'],
  ['sao-paulo', 'São Paulo'],
  ['vasco', 'Vasco da Gama'],
  ['vitoria', 'Vitória'],
].map(([id, name]) => ({ id, name, crestPath: `/escudos/${id}.svg` }));

// Clube oficial: nunca tem técnico; fora de clubes livres, cadastro, trocas e tabela. Só o admin posta por ele.
export const cbf = { id: 'cbf', name: 'CBF', crestPath: '/escudos/cbf.svg', oficial: true };
