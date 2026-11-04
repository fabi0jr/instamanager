export const PUSH_TIPOS = ['posts', 'comentarios', 'mencoes', 'cbf', 'bolao', 'trocas'] as const;
export type PushTipo = (typeof PUSH_TIPOS)[number];
export type PushPrefs = Record<PushTipo, boolean>;

/** `User.pushPrefs` guarda só o que a pessoa mexeu: chave ausente (ou lixo) vale true. */
export function prefsCompletas(v: unknown): PushPrefs {
  const o = typeof v === 'object' && v ? (v as Record<string, unknown>) : {};
  return Object.fromEntries(PUSH_TIPOS.map((t) => [t, o[t] !== false])) as PushPrefs;
}
