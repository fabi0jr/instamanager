import { ErroApi } from '../api/cliente';
import type { Post } from '../feed/tipos';

// POST /api/posts por XMLHttpRequest: o fetch não informa o progresso do upload.
export function enviarPost(form: FormData, aoProgresso: (carregado: number, total: number) => void) {
  return enviarForm<Post>('/api/posts', form, aoProgresso);
}

export function enviarForm<T>(url: string, form: FormData, aoProgresso: (carregado: number, total: number) => void) {
  const xhr = new XMLHttpRequest();
  const promessa = new Promise<T>((ok, falha) => {
    xhr.open('POST', url);
    xhr.upload.onprogress = (e) => e.lengthComputable && aoProgresso(e.loaded, e.total);
    xhr.onload = () => {
      let corpo: { codigo?: string; mensagem?: string } | null = null;
      try {
        corpo = JSON.parse(xhr.responseText);
      } catch {
        /* 413 do nginx e 502 vêm em HTML */
      }
      if (xhr.status >= 200 && xhr.status < 300) ok(corpo as unknown as T);
      else falha(new ErroApi(xhr.status, corpo?.codigo ?? 'ERRO_DESCONHECIDO', corpo?.mensagem ?? 'Algo deu errado'));
    };
    xhr.onerror = () => falha(new ErroApi(0, 'SEM_REDE', 'Sem conexão'));
    xhr.onabort = () => falha(new ErroApi(0, 'CANCELADO', 'Cancelado'));
    xhr.send(form);
  });
  return { promessa, cancelar: () => xhr.abort() };
}
