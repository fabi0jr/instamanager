// "Novidades do InstaManager": aparece uma vez por aparelho depois que a pessoa atualiza.
// Para a próxima versão, troque o `id` e os `itens` (escritos à mão).
export const NOVIDADES = {
  id: '2026-11-pack3-a',
  itens: [
    '👤 Perfil de cada técnico',
    '📅 Calendário do Brasileirão e Copa do Brasil',
    '⚽ Bolão com ranking: placar exato 3 pts',
    '🔔 Escolha quais avisos receber',
  ],
};

export const CHAVE_NOVIDADES = 'im:novidades-vistas';
export const jaViuNovidades = () => localStorage.getItem(CHAVE_NOVIDADES) === NOVIDADES.id;
export const marcarNovidadesVistas = () => localStorage.setItem(CHAVE_NOVIDADES, NOVIDADES.id);
