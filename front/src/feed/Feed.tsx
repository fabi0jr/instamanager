import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { api, type Me } from '../api/cliente';
import { lerAviso } from '../aviso';
import './feed.css';
import { Link } from '../rotas';
import { CardPost } from './CardPost';
import type { Pagina, Post } from './tipos';

// Ao abrir um post/clube e voltar, o Feed remonta: guarda lista e rolagem para voltar ao mesmo ponto sem refazer a busca.
let guardado: { meId: string; itens: Post[]; proximo: string | null; y: number } | null = null;
export const esquecerFeed = () => (guardado = null); // chamar quando a lista muda por fora (ex.: post novo publicado)

export function Feed({ me }: { me: Me }) {
  const volta = guardado?.meId === me.id ? guardado : null;
  const [itens, setItens] = useState<Post[]>(volta?.itens ?? []);
  const [proximo, setProximo] = useState<string | null>(volta?.proximo ?? null);
  const [estado, setEstado] = useState<'carregando' | 'ok' | 'erro'>(volta ? 'ok' : 'carregando');
  const atual = useRef({ itens, proximo });
  atual.current = { itens, proximo };
  const [erroMais, setErroMais] = useState(false);
  const [aviso, setAviso] = useState(lerAviso);
  const ocupado = useRef(false);
  const fim = useRef<HTMLDivElement>(null);

  const carregar = useCallback(async (cursor: string | null) => {
    if (ocupado.current) return;
    ocupado.current = true;
    setErroMais(false);
    try {
      const pg = await api<Pagina<Post>>('/posts' + (cursor ? `?antes=${encodeURIComponent(cursor)}` : ''));
      setItens((l) => (cursor ? [...l, ...pg.itens] : pg.itens));
      setProximo(pg.proximo);
      setEstado('ok');
    } catch {
      if (cursor) setErroMais(true);
      else setEstado('erro');
    } finally {
      ocupado.current = false;
    }
  }, []);
  useEffect(() => {
    if (!volta) carregar(null);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // A rolagem é anotada enquanto a pessoa rola: ao sair da tela o navegador já pode ter zerado/limitado o scrollY,
  // então ler window.scrollY só na saída devolve 0. A restauração roda antes da pintura, com a lista já no DOM.
  const y = useRef(volta?.y ?? 0);
  useEffect(() => {
    const anotar = () => (y.current = window.scrollY);
    addEventListener('scroll', anotar, { passive: true });
    return () => removeEventListener('scroll', anotar);
  }, []);
  useLayoutEffect(() => {
    if (volta) window.scrollTo(0, volta.y);
    return () => {
      guardado = { meId: me.id, ...atual.current, y: y.current };
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(''), 3000);
    return () => clearTimeout(t);
  }, [aviso]);

  // rolagem infinita: o sentinela no fim da lista pede a próxima página (começa 600 px antes)
  useEffect(() => {
    if (!fim.current || !proximo || erroMais) return;
    const io = new IntersectionObserver((e) => e[0]?.isIntersecting && carregar(proximo), { rootMargin: '600px' });
    io.observe(fim.current);
    return () => io.disconnect();
  }, [proximo, erroMais, carregar, estado]);

  function apagado(id: string) {
    setItens((l) => l.filter((p) => p.id !== id));
    setAviso('Post apagado');
  }

  return (
    <div className="feed">
      <header className="topo-feed"><img src="/icones/icon-192.png" alt="" width="32" height="32" /><span>InstaManager</span></header>
      {estado === 'carregando' && <div aria-busy="true">{[0, 1].map((n) => <div key={n} className="esqueleto card-esq" />)}</div>}
      {estado === 'erro' && (
        <div className="caixa-info" role="alert">
          <h2>Não deu para carregar o feed</h2>
          <p className="giz2">Confira a conexão e tente de novo.</p>
          <button type="button" className="botao secundario" onClick={() => { setEstado('carregando'); carregar(null); }}>Tentar de novo</button>
        </div>
      )}
      {estado === 'ok' && itens.length === 0 && (
        <div className="caixa-info">
          <h2>Ainda não tem post por aqui</h2>
          <p className="giz2">Quando alguém publicar, o post aparece aqui. Que tal abrir o jogo?</p>
          {me.clube ? (
            <Link para="/postar" className="botao">Novo post</Link>
          ) : (
            <>
              <p className="giz2">Só técnico de clube posta.</p>
              <Link para="/clubes" className="botao secundario">Ver clubes livres</Link>
            </>
          )}
        </div>
      )}
      {itens.map((p, i) => <CardPost key={p.id} post={p} me={me} prioridade={i === 0} aoApagar={apagado} aoMudar={(n) => setItens((l) => l.map((x) => (x.id === n.id && x !== n ? n : x)))} />)}
      {erroMais && (
        <div className="caixa-info" role="alert">
          <p>Não deu para carregar mais posts.</p>
          <button type="button" className="botao secundario" onClick={() => carregar(proximo)}>Tentar de novo</button>
        </div>
      )}
      <div ref={fim} />
      {estado === 'ok' && itens.length > 0 && !proximo && <p className="giz3 fim-lista">Você viu tudo por aqui.</p>}
      {aviso && <div role="status" className="toast">{aviso}</div>}
    </div>
  );
}
