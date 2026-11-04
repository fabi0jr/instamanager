import { GradeCapas } from '../feed/GradeCapas';
import { usePaginado } from '../paginado';
import type { Post } from '../feed/tipos';
import '../clube/clube.css';

// /tag/:tag: a mesma grade do clube, com posts que têm #tag na legenda ou no texto
export function Tag({ tag }: { tag: string }) {
  const lista = usePaginado<Post>('/posts', { tag });
  return (
    <div className="clube tag-pagina">
      <h1 className="titulo-pagina">#{tag}</h1>
      {lista.estado === 'carregando' && <div className="grade-capas" aria-busy="true">{Array.from({ length: 12 }, (_, i) => <div key={i} className="esqueleto" />)}</div>}
      {lista.estado === 'erro' && (
        <div className="caixa-info" role="alert"><h2>Não deu para carregar</h2><button type="button" className="botao secundario" onClick={lista.recarregar}>Tentar de novo</button></div>
      )}
      {lista.estado === 'ok' && lista.itens.length === 0 && (
        <div className="caixa-info"><h2>Nenhum post com #{tag} ainda.</h2></div>
      )}
      <GradeCapas posts={lista.itens} />
      {lista.erroMais && <div className="caixa-info" role="alert"><p>Não deu para carregar mais posts.</p><button type="button" className="botao secundario" onClick={lista.maisUm}>Tentar de novo</button></div>}
      <div ref={lista.fim} />
    </div>
  );
}
