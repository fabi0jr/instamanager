import { PUBLICAS } from '../rotas';

// Link aberto sem sessão (ex.: toque num push): guarda a rota e devolve depois do login, uma vez só.
const CHAVE = 'im:volta';

/** Só caminho do próprio app: começa com uma barra, sem // nem \ (nada de URL externa) e fora das telas de acesso. */
export function guardarVolta(destino: string) {
  const caminho = destino.split('?')[0];
  if (!destino.startsWith('/') || destino.startsWith('//') || destino.includes('\\') || caminho === '/' || PUBLICAS.includes(caminho) || caminho === '/nova-senha') return;
  sessionStorage.setItem(CHAVE, destino);
}

export function lerVolta(): string | null {
  const v = sessionStorage.getItem(CHAVE);
  sessionStorage.removeItem(CHAVE);
  return v;
}

/**
 * Chamado ao carregar o app: o endereço de entrada (ex.: toque num push) é guardado já, porque o primeiro /me sem sessão
 * leva a /entrar antes de a tela renderizar. Se a pessoa já estiver logada, o App só limpa isso sem mudar de página.
 */
export const capturarEntrada = () => guardarVolta(location.pathname + location.search);
if (typeof window !== 'undefined') capturarEntrada();
