// "Novidades do InstaManager": aparece uma vez por aparelho depois que a pessoa atualiza.
// Para a próxima versão, troque o `id` e os `itens` (escritos à mão).
export const NOVIDADES = {
  id: '2026-11-onda-b',
  itens: [
    '🏆 Liga com tabela e rodadas',
    '📣 CBF posta o resumo da rodada (com zoeira)',
    '🗳️ Votações e selos para os clubes',
    '👀 Veja quem reagiu nos posts',
    '💬 Prévia dos posts no WhatsApp',
  ],
};

export const CHAVE_NOVIDADES = 'im:novidades-vistas';
export const jaViuNovidades = () => localStorage.getItem(CHAVE_NOVIDADES) === NOVIDADES.id;
export const marcarNovidadesVistas = () => localStorage.setItem(CHAVE_NOVIDADES, NOVIDADES.id);
