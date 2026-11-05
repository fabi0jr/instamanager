import { existsSync, realpathSync } from 'node:fs';
import { isAbsolute, relative, resolve, sep } from 'node:path';

const fora = (rel) => rel === '' || rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel);

// resolve `alvo` (relativo à `raiz`, ou absoluto) e devolve o caminho só se ficar DENTRO de `base`; senão null.
// Também confere o caminho real, para um link simbólico não escapar.
export function dentroDe(base, alvo, raiz) {
  const abs = resolve(raiz, String(alvo));
  if (fora(relative(resolve(base), abs))) return null;
  if (existsSync(abs) && existsSync(base) && fora(relative(realpathSync(base), realpathSync(abs)))) return null;
  return abs;
}
