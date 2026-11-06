// leva o item ativo para a vista só na horizontal da faixa (scrollIntoView puxaria o #rolagem na vertical)
export function mostrarAtivo(faixaSel: string, ativoSel: string) {
  const faixa = document.querySelector<HTMLElement>(faixaSel);
  const ativa = faixa?.querySelector<HTMLElement>(ativoSel);
  if (!faixa || !ativa) return;
  const f = faixa.getBoundingClientRect(), a = ativa.getBoundingClientRect();
  faixa.scrollLeft += a.left < f.left ? a.left - f.left : a.right > f.right ? a.right - f.right : 0;
}
