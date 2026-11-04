import { useEffect, useState } from 'react';
import { api, type Me } from '../api/cliente';
import { Link, navegar } from '../rotas';
import { Carrossel } from './Carrossel';
import { Comentarios } from './Comentarios';
import { Escudo } from './Escudo';
import { Folha } from './Folha';
import { IcComentar, IcCurtir, IcEditar, IcLixo, IcMais } from './icones';
import { haQuanto, type Post } from './tipos';

type Props = {
  post: Post;
  me: Me;
  prioridade?: boolean;
  abrirComentarios?: boolean;
  aoApagar?: (id: string) => void;
  aoMudar?: (p: Post) => void; // o Feed guarda a versão mais nova (curtida, contagem) para ao voltar
};

export function CardPost({ post: inicial, me, prioridade, abrirComentarios, aoApagar, aoMudar }: Props) {
  const [post, setPost] = useState(inicial);
  // o Feed pode trazer a versão nova do mesmo post (puxar/Novos posts): sem isto o card seguiria com curtidas e legenda velhas
  const [recebido, setRecebido] = useState(inicial);
  if (inicial !== recebido) { setRecebido(inicial); setPost(inicial); }
  useEffect(() => { aoMudar?.(post); }, [post]); // eslint-disable-line react-hooks/exhaustive-deps
  const [aviso, setAviso] = useState('');
  const [menu, setMenu] = useState<'menu' | 'apagar' | null>(null);
  const [comentando, setComentando] = useState(!!abrirComentarios);
  const [expandida, setExpandida] = useState(false);

  async function alternarCurtida(curtir = !post.curtiu) {
    setAviso('');
    setPost((p) => ({ ...p, curtiu: curtir, curtidas: p.curtidas + (curtir ? 1 : -1) }));
    try {
      await api(`/posts/${post.id}/curtida`, { method: curtir ? 'PUT' : 'DELETE' });
    } catch {
      setPost((p) => ({ ...p, curtiu: !curtir, curtidas: p.curtidas + (curtir ? -1 : 1) }));
      setAviso('Não deu para curtir. Tente de novo.');
    }
  }

  async function apagar() {
    try {
      await api(`/posts/${post.id}`, { method: 'DELETE' });
      aoApagar?.(post.id);
    } catch {
      setMenu(null);
      setAviso('Não deu para apagar. Tente de novo.');
    }
  }

  // shortcut: "mais" aparece por tamanho do texto, não por medir as linhas; medir se ficar impreciso
  const longa = post.legenda.length > 120 || post.legenda.includes('\n');

  return (
    <article className="card" aria-label={`Post do ${post.clube.nome}`}>
      <header className="cabecalho">
        <Link para={`/c/${post.clube.id}`} className="clube-link">
          <Escudo src={post.clube.escudoUrl} tam={40} />
          <span>
            <strong className="nome-clube">{post.clube.nome}</strong>
            <span className="giz2 legenda-s">por {post.autor.nome} · {haQuanto(post.criadoEm)}</span>
          </span>
        </Link>
        {post.podeEditar && <button type="button" aria-label="Mais opções" onClick={() => setMenu('menu')}><IcMais /></button>}
      </header>

      <Carrossel post={post} prioridade={prioridade} aoDuploToque={() => !post.curtiu && alternarCurtida(true)} />

      <div className="acoes">
        <button type="button" className={post.curtiu ? 'curtido' : ''} aria-pressed={post.curtiu} aria-label={post.curtiu ? 'Descurtir' : 'Curtir'} onClick={() => alternarCurtida()}>
          <IcCurtir cheio={post.curtiu} />
        </button>
        <button type="button" aria-label="Comentar" onClick={() => setComentando(true)}><IcComentar /></button>
      </div>
      <div aria-live="polite" className="curtidas numero">
        {post.curtidas > 0 && `${post.curtidas} ${post.curtidas === 1 ? 'curtida' : 'curtidas'}`}
      </div>
      {aviso && <p role="alert" className="erro-txt aviso-card">{aviso}</p>}

      {post.legenda && (
        <div className="legenda-bloco">
          <p className={`legenda-post ${expandida ? '' : 'corta'}`}>
            <strong>{post.autor.nome}</strong> {post.legenda}
          </p>
          {longa && !expandida && <button type="button" className="link giz2" onClick={() => setExpandida(true)}>mais</button>}
        </div>
      )}
      <button type="button" className="link giz2 ver-coment" onClick={() => setComentando(true)}>
        {post.comentarios > 0 ? `Ver os ${post.comentarios} comentários` : 'Comentar'}
      </button>

      {comentando && (
        <Comentarios postId={post.id} me={me} aoFechar={() => setComentando(false)} aoContar={(n) => setPost((p) => (p.comentarios === n ? p : { ...p, comentarios: n }))} />
      )}
      {menu === 'menu' && (
        <Folha titulo="Opções do post" aoFechar={() => setMenu(null)}>
          <div className="alca" aria-hidden="true" />
          <button type="button" className="item-folha" onClick={() => navegar(`/p/${post.id}/editar`)}><IcEditar />Editar legenda e prompts</button>
          <hr className="divisor" />
          <button type="button" className="item-folha perigo" onClick={() => setMenu('apagar')}><IcLixo />Apagar post</button>
          <button type="button" className="botao fantasma" onClick={() => setMenu(null)}>Cancelar</button>
        </Folha>
      )}
      {menu === 'apagar' && (
        <Folha titulo="Apagar post" aoFechar={() => setMenu(null)} centro>
          <h2>Apagar este post?</h2>
          <p className="giz2">As imagens, as curtidas e os comentários também somem. Não dá para desfazer.</p>
          <button type="button" className="botao" onClick={apagar}>Apagar post</button>
          <button type="button" className="botao secundario" onClick={() => setMenu(null)}>Manter post</button>
        </Folha>
      )}
    </article>
  );
}
