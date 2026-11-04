import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { api, type Me } from '../api/cliente';
import { lerAviso } from '../aviso';
import { posicao, rolagem, rolarPara } from '../rolagem';
import './feed.css';
import { Link } from '../rotas';
import { cacheFeed, escondidos, esquecerFeed } from './cacheFeed';
import { CardPost } from './CardPost';
import type { Pagina, Post } from './tipos';

const MIN_VOLTA = 60_000; // voltar ao app antes disso não confere post novo
const PUXAR = 80; // px de arrasto do dedo para disparar o puxar-para-atualizar
const topoNormal = (l: Post[]) => l.find((p) => !p.fixado)?.id;
export { esquecerFeed }; // reexporta: os demais arquivos importam daqui

export function Feed({ me }: { me: Me }) {
  const volta = cacheFeed.atual?.meId === me.id ? cacheFeed.atual : null;
  const [itens, setItens] = useState<Post[]>(volta?.itens ?? []);
  const [proximo, setProximo] = useState<string | null>(volta?.proximo ?? null);
  const [estado, setEstado] = useState<'carregando' | 'ok' | 'erro'>(volta ? 'ok' : 'carregando');
  const atual = useRef({ itens, proximo, estado });
  atual.current = { itens, proximo, estado };
  const ultima = useRef(volta?.quando ?? Date.now()); // última vez que o topo do feed foi conferido
  const [novos, setNovos] = useState(false);
  const [puxado, setPuxado] = useState(0);
  const [atualizando, setAtualizando] = useState(false);
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
      // fixados só vêm na 1ª página e ficam no topo; o servidor não os repete em itens
      setItens((l) => (cursor ? [...l, ...pg.itens] : [...(pg.fixados ?? []), ...pg.itens]));
      setProximo(pg.proximo);
      setEstado('ok');
      if (!cursor) { ultima.current = Date.now(); setNovos(false); }
    } catch {
      if (cursor) setErroMais(true);
      else if (atual.current.itens.length === 0) setEstado('erro'); // atualizar com lista na tela não a apaga
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
    const r = rolagem();
    const anotar = () => (y.current = posicao());
    r?.addEventListener('scroll', anotar, { passive: true });
    return () => r?.removeEventListener('scroll', anotar);
  }, []);
  useLayoutEffect(() => {
    if (volta) rolarPara(volta.y);
    return () => {
      const { itens: todos, proximo, estado } = atual.current;
      const itens = todos.filter((p) => !escondidos.has(p.id)); // ocultados para mim ainda no Desfazer
      // só lista carregada de verdade: guardar vazio/carregando (ex.: redirect para /instalar no 1º login) faria o feed voltar vazio
      if (estado !== 'ok' || itens.length === 0) return void (cacheFeed.atual = null);
      cacheFeed.atual = { meId: me.id, itens, proximo, y: y.current, quando: ultima.current };
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(''), 3000);
    return () => clearTimeout(t);
  }, [aviso]);

  // Voltar ao app (iPhone: PWA volta do segundo plano sem recarregar): depois de 60 s confere o topo; sem endpoint novo,
  // é a mesma página 1 de /posts. O pedido duplicado é barrado por `ocupado`; a lista só muda se a pessoa tocar em "Novos posts".
  useEffect(() => {
    async function conferir() {
      if (document.visibilityState === 'hidden' || atual.current.estado !== 'ok' || ocupado.current) return;
      if (Date.now() - ultima.current < MIN_VOLTA) return;
      ocupado.current = true;
      try {
        const pg = await api<Pagina<Post>>('/posts');
        ultima.current = Date.now();
        // compara o 1º post que não é fixado: um fixado novo no topo não é "post novo"
        if (topoNormal([...(pg.fixados ?? []), ...pg.itens]) !== topoNormal(atual.current.itens)) setNovos(true);
      } catch {
        // sem rede ao voltar: tenta de novo na próxima volta
      } finally {
        ocupado.current = false;
      }
    }
    document.addEventListener('visibilitychange', conferir);
    return () => document.removeEventListener('visibilitychange', conferir);
  }, []);

  async function atualizar() {
    setAtualizando(true);
    await carregar(null);
    setAtualizando(false);
  }
  const verNovos = () => { rolarPara(0); atualizar(); };

  // puxar para atualizar: só vale se o gesto começou com a página no topo
  useEffect(() => {
    let inicio: number | null = null;
    let dy = 0;
    // folha de comentários (.veu) e detalhe da galeria rolam por cima: o gesto dentro deles não é do feed
    const comeca = (e: TouchEvent) => {
      const dentro = e.target instanceof Element && e.target.closest('.veu, .detalhe');
      inicio = posicao() <= 0 && !dentro ? e.touches[0]?.clientY ?? null : null;
      dy = 0;
    };
    const move = (e: TouchEvent) => {
      if (inicio === null) return;
      dy = Math.max(0, (e.touches[0]?.clientY ?? inicio) - inicio);
      setPuxado(Math.min(dy / 2, 64));
    };
    const solta = () => {
      if (inicio !== null && dy >= PUXAR) atualizar();
      inicio = null; dy = 0; setPuxado(0);
    };
    document.addEventListener('touchstart', comeca, { passive: true });
    document.addEventListener('touchmove', move, { passive: true });
    document.addEventListener('touchend', solta);
    document.addEventListener('touchcancel', solta);
    return () => {
      document.removeEventListener('touchstart', comeca);
      document.removeEventListener('touchmove', move);
      document.removeEventListener('touchend', solta);
      document.removeEventListener('touchcancel', solta);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // rolagem infinita: o sentinela no fim da lista pede a próxima página (começa 600 px antes)
  useEffect(() => {
    if (!fim.current || !proximo || erroMais) return;
    const io = new IntersectionObserver((e) => e[0]?.isIntersecting && carregar(proximo), { root: rolagem(), rootMargin: '600px' });
    io.observe(fim.current);
    return () => io.disconnect();
  }, [proximo, erroMais, carregar, estado]);

  // sumiu de vez (acabou o Desfazer do 'Ocultar para mim'): sai da lista sem aviso
  const sumiu = (id: string) => setItens((l) => l.filter((p) => p.id !== id));

  function apagado(id: string) {
    setItens((l) => l.filter((p) => p.id !== id));
    setAviso('Post apagado');
  }

  return (
    <div className="feed">
      <header className="topo-feed"><img src="/icones/icon-192.png" alt="" width="32" height="32" /><span>InstaManager</span></header>
      {(puxado > 0 || atualizando) && (
        <div className="puxar" style={{ height: atualizando ? 48 : puxado }} role={atualizando ? 'status' : undefined} aria-label={atualizando ? 'Atualizando' : undefined}>
          <div className="carregando" style={{ opacity: atualizando ? 1 : puxado / 64 }} />
        </div>
      )}
      {novos && estado === 'ok' && <button type="button" className="botao novos-posts" onClick={verNovos}>Novos posts</button>}
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
      {itens.map((p, i) => <CardPost key={p.id} post={p} me={me} prioridade={i === 0} aoApagar={apagado} aoOcultarParaMim={sumiu} aoReordenar={() => carregar(null)} aoMudar={(n) => setItens((l) => l.map((x) => (x.id === n.id && x !== n ? n : x)))} />)}
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
