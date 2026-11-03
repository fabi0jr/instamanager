// Que aparelho é, e se o app já está na tela inicial. Tudo lido na hora (nada em cache): os testes trocam o navigator.
export const ehIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export const ehAndroid = () => /Android/.test(navigator.userAgent);
export const instalado = () =>
  (navigator as { standalone?: boolean }).standalone === true || (typeof matchMedia === 'function' && matchMedia('(display-mode: standalone)').matches);

// O Chrome dispara beforeinstallprompt uma vez, cedo: guarda o evento para o botão "Instalar app" usar quando a tela abrir.
export type PromptInstalar = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };
let adiado: PromptInstalar | null = null;
const ouvintes = new Set<() => void>();
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    adiado = e as PromptInstalar;
    ouvintes.forEach((f) => f());
  });
}
export const promptAdiado = () => adiado;
export function aoChegarPrompt(f: () => void) {
  ouvintes.add(f);
  return () => void ouvintes.delete(f);
}
export const limparPrompt = () => (adiado = null);
