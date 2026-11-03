export class ErroApi extends Error {
  constructor(
    public status: number,
    public codigo: string,
    mensagem: string,
  ) {
    super(mensagem);
  }
}

// Cookie de sessão vai sozinho (mesma origem). Corpo FormData segue sem Content-Type, o navegador põe o boundary.
export async function api<T>(caminho: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api${caminho}`, {
    credentials: 'same-origin',
    ...init,
    headers: { ...(typeof init.body === 'string' && { 'Content-Type': 'application/json' }), ...init.headers },
  });
  if (res.status === 204) return undefined as T;
  const corpo = await res.json().catch(() => null);
  if (!res.ok) throw new ErroApi(res.status, corpo?.codigo ?? 'ERRO_DESCONHECIDO', corpo?.mensagem ?? 'Algo deu errado');
  return corpo as T;
}

export type ClubeMini = { id: string; nome: string; escudoUrl: string };
export type Me = {
  id: string;
  nome: string;
  email: string;
  avatarUrl: string | null;
  isAdmin: boolean;
  pushEnabled: boolean;
  clube: ClubeMini | null;
};
