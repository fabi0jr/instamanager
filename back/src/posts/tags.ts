/** minúsculas, sem acento, só [a-z0-9_] */
export const normalizarTag = (s: string) =>
  s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9_]/g, '');

/** `#tag` só no começo ou depois de espaço/pontuação: nunca colado em palavra nem depois de `/` (URL). */
export function extrairTags(texto: string): string[] {
  const tags = [...texto.matchAll(/(?<![\p{L}\p{N}_/#&])#([\p{L}\p{N}_]+)/gu)].map((m) => normalizarTag(m[1]));
  return [...new Set(tags.filter(Boolean))];
}
