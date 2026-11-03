import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { api, type Me } from '../api/cliente';
import { Escudo } from '../feed/Escudo';
import { IcCopiar, IcFechar, IcOk } from '../feed/icones';
import { haQuanto, type Post } from '../feed/tipos';
import { Link, voltar } from '../rotas';

// Copia pelo clipboard; sem ele (ou bloqueado), tenta o execCommand sobre o texto selecionado
async function copiar(texto: string, no: HTMLElement | null) {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    if (!no) return false;
    const sel = getSelection();
    const faixa = document.createRange();
    faixa.selectNodeContents(no);
    sel?.removeAllRanges();
    sel?.addRange(faixa);
    return typeof document.execCommand === 'function' && document.execCommand('copy');
  }
}

export function Detalhe({ imagemId, postId }: { imagemId: string; postId: string }) {
  const [post, setPost] = useState<Post | 'carregando' | 'erro'>('carregando');
  const [indice, setIndice] = useState<number | null>(null);
  const [copia, setCopia] = useState<'ok' | 'falhou' | null>(null);
  const texto = useRef<HTMLParagraphElement>(null);
  const caixa = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPost('carregando');
    api<Post>(`/posts/${postId}`).then(setPost, () => setPost('erro'));
  }, [postId]);
  useEffect(() => caixa.current?.focus(), [post]);
  useEffect(() => {
    if (copia !== 'ok') return;
    const t = setTimeout(() => setCopia(null), 2000);
    return () => clearTimeout(t);
  }, [copia]);

  // veio do feed (Ver prompt) ou da grade: voltar devolve a tela de origem; link direto cai na galeria
  const fechar = () => voltar('/galeria');
  const comPrompt = post !== 'carregando' && post !== 'erro' ? post.imagens.filter((i) => i.prompt) : [];
  const atual = indice ?? Math.max(0, comPrompt.findIndex((i) => i.id === imagemId));
  const img = comPrompt[atual];

  function ir(delta: number) {
    setCopia(null);
    setIndice(Math.min(comPrompt.length - 1, Math.max(0, atual + delta)));
  }
  function tecla(e: KeyboardEvent) {
    if (e.key === 'Escape') fechar();
    if (e.key === 'ArrowRight') ir(1);
    if (e.key === 'ArrowLeft') ir(-1);
  }

  return (
    <div ref={caixa} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Detalhe do prompt" className="detalhe" onKeyDown={tecla}>
      <header className="detalhe-topo">
        <button type="button" aria-label="Fechar" onClick={fechar}><IcFechar /></button>
        {comPrompt.length > 1 && <span>Imagem {atual + 1} de {comPrompt.length}</span>}
      </header>
      {post === 'carregando' && <div className="esqueleto" style={{ height: 390 }} aria-busy="true" />}
      {post === 'erro' && <div className="caixa-info" role="alert"><h2>Não deu para carregar o prompt</h2><button type="button" className="botao secundario" onClick={fechar}>Voltar à galeria</button></div>}
      {typeof post === 'object' && img && (
        <>
          <div className="detalhe-corpo">
            <img src={img.cheiaUrl} alt={`Imagem ${atual + 1} de ${comPrompt.length}`} />
            <Link para={`/c/${post.clube.id}`} className="clube-link">
              <Escudo src={post.clube.escudoUrl} tam={40} />
              <span><strong className="nome-clube">{post.clube.nome}</strong><span className="giz2 legenda-s">por {post.autor.nome} · {haQuanto(post.criadoEm)}</span></span>
            </Link>
            <section className={`cartao-prompt ${copia === 'falhou' ? 'falhou' : ''}`}>
              <h2>Prompt</h2>
              <p ref={texto} className="prompt-texto">{img.prompt}</p>
              {copia === 'falhou' && <p role="alert" className="erro-txt">Toque e segure no texto para copiar.</p>}
            </section>
          </div>
          <div className="detalhe-acoes">
            <button
              type="button"
              className={`botao ${copia === 'ok' ? 'secundario' : ''}`}
              onClick={async () => setCopia((await copiar(img.prompt!, texto.current)) ? 'ok' : 'falhou')}
            >
              {copia === 'ok' ? <><IcOk />Prompt copiado</> : <><IcCopiar />Copiar prompt</>}
            </button>
            <Link para={`/p/${post.id}`} className="botao fantasma">Ver o post</Link>
          </div>
          <div role="status" className={copia === 'ok' ? 'toast' : 'sr'}>{copia === 'ok' && 'Prompt copiado para a área de transferência'}</div>
        </>
      )}
    </div>
  );
}
