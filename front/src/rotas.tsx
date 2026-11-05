import { rolarPara } from './rolagem';
import { useSyncExternalStore, type AnchorHTMLAttributes, type MouseEvent } from 'react';

// Trocar de tela começa no topo (quem rola é o #rolagem); só o caminho conta: ?imagem= abre por cima sem rolar.
let ultimoCaminho = location.pathname;
addEventListener('popstate', () => {
  if (location.pathname === ultimoCaminho) return;
  ultimoCaminho = location.pathname;
  rolarPara(0); // o Feed restaura a própria posição depois, no render
});

// Roteador mínimo com a History API: evita dependência nova (copiado do Terrato, com parâmetros).
function assinar(aviso: () => void) {
  addEventListener('popstate', aviso);
  return () => removeEventListener('popstate', aviso);
}

export function useCaminho() {
  return useSyncExternalStore(assinar, () => location.pathname);
}

// Voltar de verdade só quando a entrada anterior é do app (estado gravado por navegar); link direto/externo cai no `fallback`
export function voltar(fallback: string) {
  if (history.state?.interno) history.back();
  else navegar(fallback);
}

// parâmetros da query (?imagem=…): a tela decide o que mostrar por cima, sem trocar de rota
export function useBusca() {
  return new URLSearchParams(useSyncExternalStore(assinar, () => location.search));
}

export function navegar(para: string) {
  if (para === location.pathname + location.search) return;
  history.pushState({ interno: true }, '', para); // marca: a entrada anterior é do app
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

// telas de escrever/editar: sem a barra inferior no celular (cobriria o botão fixo) e sem a faixa 'Nova versão' (Atualizar perderia o que foi digitado)
export const emEdicao = (caminho: string) => caminho === '/postar' || caminho === '/stories/novo' || /^\/[pc]\/[^/]+\/editar$/.test(caminho);

const PADROES = ['/p/:id', '/p/:id/editar', '/c/:id', '/c/:id/editar', '/tag/:tag', '/votacoes/:id', '/stories/:clubeId', '/u/:id'];

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

// rotas que existem; qualquer outra mostra "Não achamos essa página" (nunca tela em branco)
const CONHECIDAS = [/^\/$/, /^\/p\/[^/]+(\/editar)?$/, /^\/c\/[^/]+(\/editar)?$/, /^\/tag\/[^/]+$/, /^\/votacoes\/[^/]+$/, /^\/stories\/[^/]+$/, /^\/u\/[^/]+$/, /^\/(clubes|galeria|liga|atividade|busca|postar|perfil|perfil\/senha|trocar|instalar|avisos)$/, /^\/admin(\/.*)?$/];
export const rotaConhecida = (caminho: string) => CONHECIDAS.some((r) => r.test(caminho));
