// Simula o contêiner #rolagem (jsdom não rola): scrollTop gravável e evento 'scroll' sob controle do teste.
export function montarRolagem() {
  document.getElementById('rolagem')?.remove(); // um só por vez, como no app
  const el = document.createElement('div');
  el.id = 'rolagem';
  document.body.append(el);
  let y = 0;
  Object.defineProperty(el, 'scrollTop', { get: () => y, set: (v: number) => { y = v; }, configurable: true });
  return { el, rolar: (v: number, avisar = true) => { y = v; if (avisar) el.dispatchEvent(new Event('scroll')); } };
}
