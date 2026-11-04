// "Novidades do InstaManager": aparece uma vez por aparelho depois que a pessoa atualiza.
// Para a próxima versão, troque o `id` e os `itens` (escritos à mão).
export const NOVIDADES = {
  id: '2026-11-onda-c',
  itens: [
    '🔔 Atividade: o que aconteceu com você',
    '@ Mencione pessoas com @',
    '🔍 Busca em posts, prompts, clubes e pessoas',
    '⭕ Stories de 24 h',
    '🎬 Vídeo de até 30 s nos posts',
  ],
};

export const CHAVE_NOVIDADES = 'im:novidades-vistas';
export const jaViuNovidades = () => localStorage.getItem(CHAVE_NOVIDADES) === NOVIDADES.id;
export const marcarNovidadesVistas = () => localStorage.setItem(CHAVE_NOVIDADES, NOVIDADES.id);
