// Trecho que casou em negrito, ignorando acento e maiúscula ("contratacao" destaca "Contratação" inteiro).
// Cada letra tira o acento sozinha (NFD sem marcas), então os índices continuam alinhados ao texto original.
const base = (c: string) => c.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

export function Destaque({ texto, q }: { texto: string; q: string }) {
  const letras = [...texto];
  const chave = letras.map(base).join('');
  const alvo = base(q.trim());
  const i = alvo ? chave.indexOf(alvo) : -1;
  if (i < 0) return <>{texto}</>;
  // índice na string normalizada → posição no original (cada letra pode virar 0 ou mais caracteres)
  const mapa: number[] = [];
  letras.forEach((c, k) => base(c).split('').forEach(() => mapa.push(k)));
  const ini = mapa[i];
  const fim = mapa[i + alvo.length - 1] + 1;
  return <>{letras.slice(0, ini).join('')}<b>{letras.slice(ini, fim).join('')}</b>{letras.slice(fim).join('')}</>;
}
