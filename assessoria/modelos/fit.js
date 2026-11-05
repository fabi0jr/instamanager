// Reduz a letra de todo [data-fit] até caber (largura e, se quebra linha, altura do próprio elemento). Grava data-fonte (px) e data-cabe.
(async () => {
  await document.fonts.ready;
  for (const el of document.querySelectorAll('[data-fit]')) {
    let s = parseFloat(getComputedStyle(el).fontSize);
    const uma = getComputedStyle(el).whiteSpace === 'nowrap'; // linha única: só a largura conta (a caixa de linha é maior que a altura do elemento)
    const cabe = () => el.scrollWidth <= el.clientWidth + 1 && (uma || el.scrollHeight <= el.clientHeight + 1);
    while (!cabe() && s > 12) { s -= 2; el.style.fontSize = s + 'px'; }
    el.dataset.fonte = String(Math.round(s));
    el.dataset.cabe = cabe() ? '1' : '0';
  }
  document.documentElement.dataset.pronto = '1';
})();
