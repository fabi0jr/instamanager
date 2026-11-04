export type ResultadoCompartilhar = 'compartilhado' | 'copiado' | 'falhou';

// Web Share onde existe; senão copia o link. A prévia do link é genérica (og no index.html): o app é fechado.
export async function compartilhar(post: { id: string }): Promise<ResultadoCompartilhar> {
  const url = `${location.origin}/p/${post.id}`;
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ title: 'InstaManager', url });
      return 'compartilhado';
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'compartilhado'; // cancelou a folha: sem aviso
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    return 'copiado';
  } catch {
    return 'falhou';
  }
}
