import { useEffect, useState } from 'react';
import { api, type Me } from '../api/cliente';
import { CardPost } from './CardPost';
import { IcVoltar } from './icones';
import type { Post } from './tipos';
import { navegar, voltar } from '../rotas';
import { esquecerFeed } from './Feed';

export function PostPagina({ id, me }: { id: string; me: Me }) {
  const [post, setPost] = useState<Post | 'carregando' | 'erro' | 'sumiu'>('carregando');
  useEffect(() => {
    setPost('carregando');
    api<Post>(`/posts/${id}`).then(setPost, (e) => setPost(e?.status === 404 ? 'sumiu' : 'erro'));
  }, [id]);
  if (post === 'carregando') return <div className="esqueleto card-esq" aria-busy="true" />;
  if (post === 'erro' || post === 'sumiu')
    return (
      <div className="caixa-info" role="alert">
        <h2>{post === 'sumiu' ? 'Esse post não existe mais' : 'Não deu para carregar o post'}</h2>
        <button type="button" className="botao secundario" onClick={() => navegar('/')}>Voltar ao feed</button>
      </div>
    );
  return (
    <>
      <header className="topo-post">
        <button type="button" aria-label="Voltar" onClick={() => voltar('/')}><IcVoltar /></button>
        <h1>Post</h1>
      </header>
      <CardPost
        post={post}
        me={me}
        prioridade
        // curtir/comentar/apagar aqui mudam o post: o feed guardado ficaria desatualizado
        aoMudar={(n) => n !== post && esquecerFeed()}
        aoApagar={() => {
          esquecerFeed();
          navegar('/');
        }}
      />
    </>
  );
}
