import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api/cliente';
import { rolagem } from './rolagem';
import type { Pagina } from './feed/tipos';

// Lista paginada por cursor (?antes=) com rolagem infinita; refaz tudo quando o caminho ou os filtros mudam.
export function usePaginado<T>(caminho: string, filtros: Record<string, string | undefined> = {}) {
  const chave = caminho + JSON.stringify(filtros);
  const [itens, setItens] = useState<T[]>([]);
  const [proximo, setProximo] = useState<string | null>(null);
  const [estado, setEstado] = useState<'carregando' | 'ok' | 'erro'>('carregando');
  const [erroMais, setErroMais] = useState(false);
  const geracao = useRef(0);
  const ocupado = useRef(false);
  const fim = useRef<HTMLDivElement>(null);

  const carregar = useCallback(
    async (cursor: string | null) => {
      if (ocupado.current) return;
      ocupado.current = true;
      setErroMais(false);
      const g = geracao.current;
      const q = new URLSearchParams();
      if (cursor) q.set('antes', cursor);
      for (const [k, v] of Object.entries(filtros)) if (v) q.set(k, v);
      try {
        const pg = await api<Pagina<T>>(caminho + (q.size ? `?${q}` : ''));
        if (g !== geracao.current) return;
        setItens((l) => (cursor ? [...l, ...pg.itens] : pg.itens));
        setProximo(pg.proximo);
        setEstado('ok');
      } catch {
        if (g !== geracao.current) return;
        if (cursor) setErroMais(true);
        else setEstado('erro');
      } finally {
        if (g === geracao.current) ocupado.current = false;
      }
    },
    [chave], // eslint-disable-line react-hooks/exhaustive-deps
  );

  useEffect(() => {
    geracao.current++;
    ocupado.current = false;
    setItens([]);
    setProximo(null);
    setEstado('carregando');
    carregar(null);
  }, [carregar]);

  useEffect(() => {
    if (!fim.current || !proximo || erroMais) return;
    const io = new IntersectionObserver((e) => e[0]?.isIntersecting && carregar(proximo), { root: rolagem(), rootMargin: '600px' });
    io.observe(fim.current);
    return () => io.disconnect();
  }, [proximo, erroMais, carregar, estado]);

  return { itens, setItens, proximo, estado, erroMais, fim, recarregar: () => { setEstado('carregando'); carregar(null); }, maisUm: () => carregar(proximo) };
}
