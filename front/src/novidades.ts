// "Novidades do InstaManager": aparece uma vez por aparelho depois que a pessoa atualiza.
// Para a próxima versão, troque o `id` e os `itens` (escritos à mão).
export const NOVIDADES = {
  id: '2026-11-pack3-b',
  itens: [
    '📊 Nível de cada técnico no perfil',
    '🏆 Conquistas: 8 para desbloquear',
    '🔔 Aviso quando você ganha uma conquista',
  ],
};

export const CHAVE_NOVIDADES = 'im:novidades-vistas';
export const jaViuNovidades = () => localStorage.getItem(CHAVE_NOVIDADES) === NOVIDADES.id;
export const marcarNovidadesVistas = () => localStorage.setItem(CHAVE_NOVIDADES, NOVIDADES.id);
