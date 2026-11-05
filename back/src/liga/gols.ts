export const MAX_GOLS = 99;
/** Fora do `liga.service` para o bolão não importar a Liga (a Liga já importa o bolão). */
export const gols = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= MAX_GOLS;
