import { useEffect, useState } from 'react';
import { api, ErroApi, type Me } from '../api/cliente';
import { Link, navegar } from '../rotas';
import { Carrossel } from './Carrossel';
import { Comentarios } from './Comentarios';
import { Denunciar } from './Denunciar';
import { Escudo } from './Escudo';
import { Texto } from './Texto';
import { Folha } from './Folha';
import { compartilhar } from './compartilhar';
import { IcBandeira, IcCompartilhar, IcComentar, IcEditar, IcFixar, IcLixo, IcMais, IcOlhoOff } from './icones';
import { devolverAoCache, esconderNoCache } from './cacheFeed';
import { BotaoReagir, comReacao, LinhaReacoes } from './Reacoes';
import { haQuanto, type Emoji, type Post } from './tipos';

type Props = {
  post: Post;
  me: Me;
  prioridade?: boolean;
  abrirComentarios?: boolean;
  aoApagar?: (id: string) => void;
  aoMudar?: (p: Post) => void; // o Feed guarda a versão mais nova (curtida, contagem) para ao voltar
  aoOcultarParaMim?: (id: string) => void; // acabou o Desfazer: sai da lista (sem o aviso de 'Post apagado')
  aoReordenar?: () => void; // fixar/desafixar muda a ordem da lista: quem lista recarrega
};

// Post só de texto: o tamanho cai com o comprimento (28/34, 24/32, 20/28); corta em 8 linhas com "mais"
function BlocoTexto({ texto, aoDuploToque }: { texto: string; aoDuploToque: () => void }) {
  const [aberto, setAberto] = useState(false);
  const tam = texto.length <= 80 ? 'texto-g' : texto.length <= 200 ? 'texto-m' : 'texto-p';
  const longa = texto.length > 200 || texto.includes('\n');
  return (
    <div className="bloco-texto" onDoubleClick={aoDuploToque}>
      <p className={`${tam} ${aberto ? '' : 'corta8'}`}><Texto>{texto}</Texto></p>
      {longa && !aberto && <button type="button" className="link giz2" onClick={() => setAberto(true)}>mais</button>}
    </div>
  );
}

export function CardPost({ post: inicial, me, prioridade, abrirComentarios, aoApagar, aoMudar, aoReordenar, aoOcultarParaMim }: Props) {
  const [post, setPost] = useState(inicial);
  // o Feed pode trazer a versão nova do mesmo post (puxar/Novos posts): sem isto o card seguiria com curtidas e legenda velhas
  const [recebido, setRecebido] = useState(inicial);
  if (inicial !== recebido) { setRecebido(inicial); setPost(inicial); }
  useEffect(() => { aoMudar?.(post); }, [post]); // eslint-disable-line react-hooks/exhaustive-deps
  const [aviso, setAviso] = useState('');
  const [menu, setMenu] = useState<'menu' | 'apagar' | null>(null);
  const [comentando, setComentando] = useState(!!abrirComentarios);
  const [expandida, setExpandida] = useState(false);
  const dono = post.podeEditar || me.isAdmin; // quem edita/apaga ganha esse menu; os outros, Ocultar para mim e Denunciar
  const [limite, setLimite] = useState(false); // 4º fixado
  const [copiado, setCopiado] = useState(false);
  const [denunciando, setDenunciando] = useState(false);
  const [enviada, setEnviada] = useState(false);
  const [sumindo, setSumindo] = useState(false); // 'Post oculto para você. Desfazer' por 6 s, depois sai da lista

  // reagir (ou tirar, com null): atualiza na hora e desfaz se a API falhar
  async function reagir(emoji: Emoji | null) {
    setAviso('');
    const antes = post;
    setPost((p) => comReacao(p, emoji));
    try {
      await (emoji ? api(`/posts/${post.id}/reacao`, { method: 'PUT', body: JSON.stringify({ emoji }) }) : api(`/posts/${post.id}/reacao`, { method: 'DELETE' }));
    } catch {
      setPost((p) => ({ ...p, curtidas: antes.curtidas, curtiu: antes.curtiu, minhaReacao: antes.minhaReacao, reacoes: antes.reacoes }));
      setAviso('Não deu para reagir. Tente de novo.');
    }
  }
  const duploToque = () => post.minhaReacao !== '❤️' && reagir('❤️'); // sempre ❤️: troca a reação, nunca tira

  async function fixar() {
    setLimite(false);
    try {
      await api(`/admin/posts/${post.id}/fixar`, { method: post.fixado ? 'DELETE' : 'PUT' });
      setPost((p) => ({ ...p, fixado: !p.fixado }));
      setMenu(null);
      aoReordenar?.();
    } catch (e) {
      if (e instanceof ErroApi && e.codigo === 'LIMITE_FIXADOS') setLimite(true);
      else {
        setMenu(null);
        setAviso('Não deu para fixar. Tente de novo.');
      }
    }
  }

  async function ocultarParaMim() {
    setMenu(null);
    setAviso('');
    try {
      await api(`/posts/${post.id}/ocultar-para-mim`, { method: 'PUT' });
      esconderNoCache(post); // já no clique: sair da tela nos 6 s não pode trazer o post de volta
      setSumindo(true);
    } catch {
      setAviso('Não deu para ocultar. Tente de novo.');
    }
  }
  async function desfazerOcultar() {
    setSumindo(false);
    devolverAoCache(post);
    try {
      await api(`/posts/${post.id}/ocultar-para-mim`, { method: 'DELETE' });
    } catch {
      esconderNoCache(post);
      setSumindo(true);
      setAviso('Não deu para desfazer. Tente de novo.');
    }
  }
  useEffect(() => {
    if (!sumindo) return;
    const t = setTimeout(() => aoOcultarParaMim?.(post.id), 6000);
    return () => clearTimeout(t);
  }, [sumindo]); // eslint-disable-line react-hooks/exhaustive-deps

  // admin: oculta/mostra para todos (ocultar também desafixa no servidor)
  async function ocultarParaTodos() {
    const novo = !post.oculto;
    setMenu(null);
    setAviso('');
    try {
      await api(`/admin/posts/${post.id}/ocultar`, { method: novo ? 'PUT' : 'DELETE' });
      setPost((p) => ({ ...p, oculto: novo, ...(novo && { fixado: false }) }));
      aoReordenar?.();
    } catch {
      setAviso('Não deu para ocultar. Tente de novo.');
    }
  }

  async function compartilharPost() {
    setAviso('');
    setCopiado(false);
    const r = await compartilhar(post);
    if (r === 'copiado') {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 3000);
    } else if (r === 'falhou') setAviso('Não deu para compartilhar. Copie o endereço do post na barra do navegador.');
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

  if (sumindo)
    return (
      <div className="card-recolhido" role="status">
        <span>Post oculto para você.</span>
        <button type="button" className="link" onClick={desfazerOcultar}>Desfazer</button>
      </div>
    );

  return (
    <article className={`card ${post.oculto ? 'card-oculto' : ''}`} aria-label={`Post do ${post.clube.nome}`}>
      {post.oculto && <p className="faixa-oculto"><IcOlhoOff />Oculto para todos. Só você, admin, vê.</p>}
      {post.fixado && <p className="selo-fixado giz2"><IcFixar />Fixado</p>}
      <header className="cabecalho">
        <Link para={`/c/${post.clube.id}`} className="clube-link">
          <Escudo src={post.clube.escudoUrl} tam={40} />
          <span>
            <strong className="nome-clube">{post.clube.nome}</strong>
            <span className="giz2 legenda-s">por {post.autor.nome} · {haQuanto(post.criadoEm)}</span>
          </span>
        </Link>
        <button type="button" aria-label="Mais opções" onClick={() => setMenu('menu')}><IcMais /></button>
      </header>

      {post.texto ? (
        <BlocoTexto texto={post.texto} aoDuploToque={duploToque} />
      ) : (
        <Carrossel post={post} prioridade={prioridade} aoDuploToque={duploToque} />
      )}

      <div className="acoes">
        <BotaoReagir minha={post.minhaReacao ?? (post.curtiu ? '❤️' : null)} aoReagir={reagir} />
        <button type="button" aria-label="Comentar" onClick={() => setComentando(true)}><IcComentar /></button>
        <button type="button" className="compartilhar" aria-label="Compartilhar" onClick={compartilharPost}><IcCompartilhar /></button>
      </div>
      <LinhaReacoes post={post} />
      {copiado && <p role="status" className="toast-card">Link copiado</p>}
      {enviada && <p role="status" className="toast-card">Denúncia enviada. O admin vai olhar.</p>}
      {aviso && <p role="alert" className="erro-txt aviso-card">{aviso}</p>}

      {post.legenda && (
        <div className="legenda-bloco">
          <p className={`legenda-post ${expandida ? '' : 'corta'}`}>
            <strong>{post.autor.nome}</strong> <Texto>{post.legenda}</Texto>
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
          {dono ? (
            <>
              <button type="button" className="item-folha" onClick={() => navegar(`/p/${post.id}/editar`)}><IcEditar />{post.texto ? 'Editar texto' : 'Editar legenda e prompts'}</button>
              {me.isAdmin && <button type="button" className="item-folha" onClick={fixar}><IcFixar />{post.fixado ? 'Desafixar' : 'Fixar no topo'}</button>}
              {limite && <p role="alert" className="aviso-ambar">Já há 3 posts fixados. Desafixe um para fixar este.</p>}
              {me.isAdmin && <button type="button" className="item-folha" onClick={ocultarParaTodos}><IcOlhoOff />{post.oculto ? 'Mostrar de novo' : 'Ocultar do feed'}</button>}
              <hr className="divisor" />
              <button type="button" className="item-folha perigo" onClick={() => setMenu('apagar')}><IcLixo />Apagar post</button>
            </>
          ) : (
            <>
              <button type="button" className="item-folha" onClick={ocultarParaMim}><IcOlhoOff />Ocultar para mim</button>
              <button type="button" className="item-folha" onClick={() => { setMenu(null); setDenunciando(true); }}><IcBandeira />Denunciar post</button>
            </>
          )}
          <button type="button" className="botao fantasma" onClick={() => setMenu(null)}>Cancelar</button>
        </Folha>
      )}
      {denunciando && <Denunciar alvo={{ postId: post.id }} aoFechar={() => setDenunciando(false)} aoEnviada={() => { setDenunciando(false); setEnviada(true); setTimeout(() => setEnviada(false), 3000); }} />}
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
