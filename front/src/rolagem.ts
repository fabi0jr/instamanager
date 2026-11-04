// Quem rola é o contêiner #rolagem (o documento fica parado): no PWA do iPhone, com viewport-fit=cover, o WebKit
// desloca os position:fixed (barra inferior) quando o documento rola. A barra fica fora do contêiner.
export const rolagem = () => document.getElementById('rolagem');
export const posicao = () => rolagem()?.scrollTop ?? 0;
export function rolarPara(y: number) {
  const r = rolagem();
  if (r) r.scrollTop = y;
}
