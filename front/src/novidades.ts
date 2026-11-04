// "Novidades do InstaManager": aparece uma vez por aparelho depois que a pessoa atualiza.
// Para a próxima versão, troque o `id` e os `itens` (escritos à mão).
export const NOVIDADES = {
  id: '2026-11-onda-a',
  itens: [
    '❤️ Reações: segure o ❤️ e escolha 🔥😂😮😢👏',
    '📝 Posts só de texto, estilo Twitter',
    '📲 Compartilhe posts no WhatsApp',
    '#️⃣ Hashtags clicáveis (#contratação)',
    '⭐ Favorite prompts na galeria',
    '🏟️ Capa e bio do seu clube',
    '📌 Posts fixados pela liga',
    '🚩 Denunciar ou ocultar posts no ⋯',
  ],
};

export const CHAVE_NOVIDADES = 'im:novidades-vistas';
export const jaViuNovidades = () => localStorage.getItem(CHAVE_NOVIDADES) === NOVIDADES.id;
export const marcarNovidadesVistas = () => localStorage.setItem(CHAVE_NOVIDADES, NOVIDADES.id);
