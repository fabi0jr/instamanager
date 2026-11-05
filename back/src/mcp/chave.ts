import { createHash, timingSafeEqual } from 'node:crypto';

const sha = (s: string) => createHash('sha256').update(s).digest();

/** `Authorization: Bearer <MCP_CHAVE>` confere? Compara os hashes: o timingSafeEqual exige o mesmo tamanho e assim o tamanho da chave não aparece. */
export function chaveConfere(authorization: string | undefined) {
  const chave = process.env.MCP_CHAVE;
  const enviada = /^Bearer (.+)$/.exec(authorization ?? '')?.[1];
  return !!chave && !!enviada && timingSafeEqual(sha(enviada), sha(chave));
}
