import { useSyncExternalStore, type AnchorHTMLAttributes, type MouseEvent } from 'react';

// Roteador mínimo com a History API: evita dependência nova (copiado do Terrato, com parâmetros).
function assinar(aviso: () => void) {
  addEventListener('popstate', aviso);
  return () => removeEventListener('popstate', aviso);
}

export function useCaminho() {
  return useSyncExternalStore(assinar, () => location.pathname);
}

// parâmetros da query (?imagem=…): a tela decide o que mostrar por cima, sem trocar de rota
export function useBusca() {
  return new URLSearchParams(useSyncExternalStore(assinar, () => location.search));
}

export function navegar(para: string) {
  if (para === location.pathname + location.search) return;
  history.pushState(null, '', para);
  dispatchEvent(new PopStateEvent('popstate'));
}

export function Link({ para, onClick, ...props }: { para: string } & AnchorHTMLAttributes<HTMLAnchorElement>) {
  const atual = useCaminho() === para;
  function clicar(e: MouseEvent<HTMLAnchorElement>) {
    onClick?.(e);
    if (e.defaultPrevented) return;
    // Ctrl/Cmd/Shift/botão do meio ou target: deixa o navegador abrir em nova aba/janela.
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (props.target && props.target !== '_self') return;
    e.preventDefault();
    navegar(para);
  }
  return <a aria-current={atual ? 'page' : undefined} {...props} href={para} onClick={clicar} />;
}

// rotas do grupo de acesso: abertas sem sessão
export const PUBLICAS = ['/entrar', '/cadastro', '/esqueci-senha', '/nova-senha'];

const PADROES = ['/p/:id', '/c/:id'];

// casa o caminho com /p/:id e /c/:id; as demais rotas não têm parâmetro
export function useRota() {
  const caminho = useCaminho();
  const partes = caminho.split('/');
  const params: Record<string, string> = {};
  for (const padrao of PADROES) {
    const modelo = padrao.split('/');
    if (modelo.length !== partes.length) continue;
    const casou = modelo.every((m, i) => (m.startsWith(':') ? partes[i] !== '' : m === partes[i]));
    if (casou) modelo.forEach((m, i) => m.startsWith(':') && (params[m.slice(1)] = decodeURIComponent(partes[i])));
  }
  return { caminho, params };
}
