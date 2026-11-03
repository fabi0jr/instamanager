// Aviso rápido que sobrevive à troca de tela (ex.: "Post publicado" depois de ir para o feed)
let pendente = '';
export const guardarAviso = (t: string) => (pendente = t);
export function lerAviso() {
  const t = pendente;
  pendente = '';
  return t;
}
