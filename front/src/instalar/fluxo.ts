import { instalado } from './plataforma';

// Uma vez por aparelho (localStorage, nunca dados de conta). "Agora não" e "ativei" marcam; o Perfil reabre pelas rotas.
export const VISTO = 'im:instalar-visto';
export const marcarVisto = () => localStorage.setItem(VISTO, '1');

/** Depois do login: para onde levar a pessoa na primeira vez neste aparelho (null = direto ao feed). */
export function proximaTela(): '/instalar' | '/avisos' | null {
  if (localStorage.getItem(VISTO)) return null;
  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') return null; // já resolvido
  if (instalado()) return '/avisos';
  return '/instalar';
}
