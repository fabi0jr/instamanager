/** Texto digitado vira padrão de LIKE literal: `\`, `%` e `_` valem como texto (o escape padrão do Postgres é a barra). */
export const escaparLike = (q: string) => q.replace(/[\\%_]/g, '\\$&');
