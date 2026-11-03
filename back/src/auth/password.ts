import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

// docs/api.md, seção 2: scrypt N=2^17, r=8, p=1. Formato guardado: scrypt$N$r$p$sal$hash (base64url).
const N = 2 ** 17;
const R = 8;
const P = 1;
const KEYLEN = 64;
const scryptAsync = promisify(scrypt) as (
  senha: string,
  sal: Buffer,
  keylen: number,
  opcoes: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>;

// N=2^17 com r=8 usa 128 MB; o padrão do Node (32 MB) recusaria.
const opcoes = (n: number, r: number, p: number) => ({ N: n, r, p, maxmem: 256 * 1024 * 1024 });

/** Semáforo: no máximo `max` execuções de `fn` ao mesmo tempo; as outras esperam na fila. */
export function semaforo(max: number) {
  let ativos = 0;
  const fila: (() => void)[] = [];
  return async <T>(fn: () => Promise<T>): Promise<T> => {
    if (ativos >= max) await new Promise<void>((libera) => fila.push(libera));
    else ativos++;
    try {
      return await fn();
    } finally {
      const proximo = fila.shift();
      if (proximo) proximo();
      else ativos--;
    }
  };
}

// cada hash usa 128 MB: no máx. 2 ao mesmo tempo (decisão do Fabio), para um pico de logins não estourar a memória
const comVaga = semaforo(2);

export async function hashPassword(senha: string): Promise<string> {
  const sal = randomBytes(16);
  const hash = await comVaga(() => scryptAsync(senha, sal, KEYLEN, opcoes(N, R, P)));
  return ['scrypt', N, R, P, sal.toString('base64url'), hash.toString('base64url')].join('$');
}

export async function verifyPassword(senha: string, guardado: string): Promise<boolean> {
  const [algoritmo, n, r, p, sal, hash] = guardado.split('$');
  if (algoritmo !== 'scrypt' || !hash) return false;
  const esperado = Buffer.from(hash, 'base64url');
  const calculado = await comVaga(() =>
    scryptAsync(senha, Buffer.from(sal, 'base64url'), esperado.length, opcoes(+n, +r, +p)),
  );
  return timingSafeEqual(calculado, esperado);
}
