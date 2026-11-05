// "Novidades do InstaManager": aparece uma vez por aparelho depois que a pessoa atualiza.
// Para a próxima versão, troque o `id` e os `itens` (escritos à mão).
export const NOVIDADES = {
  id: '2026-11-pack3-c',
  itens: [
    '✍️ Story de texto: escreva até 200 letras sobre um fundo colorido',
  ],
};

export const CHAVE_NOVIDADES = 'im:novidades-vistas';
export const jaViuNovidades = () => localStorage.getItem(CHAVE_NOVIDADES) === NOVIDADES.id;
export const marcarNovidadesVistas = () => localStorage.setItem(CHAVE_NOVIDADES, NOVIDADES.id);
