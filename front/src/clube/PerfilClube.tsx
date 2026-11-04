import { useEffect, useState } from 'react';
import { api, type Me } from '../api/cliente';
import { Escudo } from '../feed/Escudo';
import { Folha } from '../feed/Folha';
import { IcOk, IcSelo, IcSeta } from '../feed/icones';
import { textoUltimos, type Resultado } from '../liga/tipos';
import { Ultimos } from '../liga/Ultimos';
import { GradeCapas } from '../feed/GradeCapas';
import { Texto } from '../feed/Texto';
import type { Post } from '../feed/tipos';
import { usePaginado } from '../paginado';
import { Link } from '../rotas';
import './clube.css';

type Historico = { usuario: { id: string; nome: string }; inicio: string; fim: string | null };
export type Clube = { id: string; nome: string; escudoUrl: string; bio?: string | null; capaUrl?: string | null; tecnico: { id: string; nome: string } | null; historico: Historico[]; liga?: { posicao: number; ultimos: Resultado[]; pontos?: number; jogos?: number } | null; selos?: { titulo: string; createdAt: string }[] };
type Troca = { id: string; tipo: string; status: string; clubeId: string | null };

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const mesAno = (iso: string) => `${MESES[new Date(iso).getMonth()]}/${String(new Date(iso).getFullYear()).slice(2)}`;
export const data = (iso: string) => new Date(iso).toLocaleDateString('pt-BR');
export const Inicial = ({ nome, tam }: { nome: string; tam: number }) => (
  <span className="av-inicial" style={{ width: tam, height: tam, fontSize: tam * 0.4 }} aria-hidden="true">{nome[0]?.toUpperCase()}</span>
);

// Bio do clube (≤ 300): corta em 3 linhas com "mais"
function Bio({ texto }: { texto: string }) {
  const [aberta, setAberta] = useState(false);
  return (
    <div className="bio-clube">
      <p className={aberta ? '' : 'corta3'}><Texto>{texto}</Texto></p>
      {!aberta && texto.length > 120 && <button type="button" className="link giz2" onClick={() => setAberta(true)}>mais</button>}
    </div>
  );
}

export function PerfilClube({ id, me }: { id: string; me: Me }) {
  const [clube, setClube] = useState<Clube | 'carregando' | 'erro'>('carregando');
  const [aba, setAba] = useState<'posts' | 'historico'>('posts');
  const [todosSelos, setTodosSelos] = useState(false);
  const [pendente, setPendente] = useState<Troca | null>(null); // pedido pendente da pessoa, se houver
  const posts = usePaginado<Post>('/posts', { clube: id });

  function carregar() {
    setClube('carregando');
    api<Clube>(`/clubes/${id}`).then(setClube, () => setClube('erro'));
  }
  useEffect(carregar, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    // já há pedido pendente da pessoa? então o botão fica "Pedido enviado"
    api<Troca[]>('/trocas/minhas').then((l) => setPendente(l.find((t) => t.status === 'PENDENTE') ?? null), () => {});
  }, []);

  if (clube === 'carregando')
    return (
      <div className="clube" aria-busy="true">
        <div className="esqueleto" style={{ height: 160 }} />
        <div className="grade-capas">{Array.from({ length: 12 }, (_, i) => <div key={i} className="esqueleto" />)}</div>
      </div>
    );
  if (clube === 'erro')
    return (
      <div className="caixa-info clube-erro" role="alert">
        <h2>Não deu para carregar o clube</h2>
        <button type="button" className="botao secundario" onClick={carregar}>Tentar de novo</button>
      </div>
    );

  const atual = clube.historico.find((h) => h.fim === null);
  const meu = me.clube?.id === clube.id;
  const cbf = clube.id === 'cbf'; // clube oficial: sem técnico, posição, selos nem histórico (só Posts)
  const podePedir = !clube.tecnico && !meu && !cbf;
  const selos = clube.selos ?? [];
  const seloCartao = (x: { titulo: string; createdAt: string }, i: number) => (
    <li key={i} className="selo-cartao"><IcSelo /><span><strong>{x.titulo}</strong><span className="giz2 legenda-s">{mesAno(x.createdAt)}</span></span></li>
  );
  const souTecnico = clube.tecnico?.id === me.id; // técnico atual (ex-técnico não casa)
  const podeEditarClube = souTecnico || me.isAdmin;

  return (
    <div className="clube">
      <div className="clube-capa" style={clube.capaUrl ? { backgroundImage: `url(${clube.capaUrl})` } : undefined} data-sem-capa={!clube.capaUrl || undefined} />
      <header className={`clube-topo com-capa ${cbf ? 'cbf' : ''}`}>
        {cbf ? <img src="/escudos/cbf.svg" alt="" width="90" height="120" className="escudo-cbf" /> : <Escudo src={clube.escudoUrl} tam={88} />}
        <h1>{clube.nome}</h1>
        {cbf ? (
          <div>
            <span className="etiqueta-oficial"><IcOk /> Oficial</span>
            <p className="giz2">Perfil oficial da liga</p>
          </div>
        ) : clube.tecnico ? (
          <div>
            <span className="giz2 legenda-s">Técnico atual</span>
            <div className="tecnico"><Inicial nome={clube.tecnico.nome} tam={28} /><strong>{clube.tecnico.nome}</strong>{atual && <span className="giz2 legenda-s">desde {data(atual.inicio)}</span>}</div>
          </div>
        ) : (
          <div>
            <span className="vaga">Vaga aberta</span>
            <p className="giz2">Sem técnico no momento.</p>
          </div>
        )}
        {clube.bio && <Bio texto={clube.bio} />}
        {!clube.bio && souTecnico && <Link para={`/c/${clube.id}/editar`} className="adicionar-bio giz2">Adicionar bio</Link>}
        {podeEditarClube && <Link para={`/c/${clube.id}/editar`} className="botao fantasma editar-clube-btn">Editar clube</Link>}
        {(souTecnico || (cbf && me.isAdmin)) && <Link para={cbf ? '/stories/novo?cbf=1' : '/stories/novo'} className="botao fantasma editar-clube-btn">{cbf ? 'Novo story da CBF' : 'Novo story'}</Link>}
        {podePedir && (
          <>
            {pendente && pendente.clubeId === clube.id ? (
              <>
                <button type="button" className="botao" disabled>Pedido enviado</button>
                <p className="giz2 centro">Aguardando o admin.</p>
              </>
            ) : pendente ? (
              <>
                <button type="button" className="botao" disabled>Você já tem um pedido pendente</button>
                <p className="giz2 centro">Espere o admin decidir para pedir outro.</p>
              </>
            ) : (
              <Link para={`/trocar?clube=${clube.id}`} className="botao">Pedir este clube</Link>
            )}
          </>
        )}
      </header>

      {!cbf && clube.liga && clube.liga.ultimos.length > 0 && (
        <Link para="/liga" className="cartao-liga" aria-label={`${clube.liga.posicao}º na Liga, ${textoUltimos(clube.liga.ultimos)}`}>
          <strong>{clube.liga.posicao}º</strong><span className="giz2">na Liga{clube.liga.pontos !== undefined && <span className="legenda-s giz3"> · {clube.liga.pontos} pontos · {clube.liga.jogos} jogos</span>}</span><Ultimos valores={clube.liga.ultimos} /><IcSeta />
        </Link>
      )}
      {!cbf && selos.length > 0 && (
        <section className="selos" aria-label="Selos">
          <p className="giz2 legenda-s">SELOS</p>
          <ul>{selos.slice(0, 6).map(seloCartao)}</ul>
          {selos.length > 6 && <button type="button" className="link giz2" onClick={() => setTodosSelos(true)}>Ver todos</button>}
        </section>
      )}
      {todosSelos && (
        <Folha titulo="Selos" aoFechar={() => setTodosSelos(false)}>
          <h2 data-foco tabIndex={-1}>Selos</h2>
          <ul className="selos-todos">{selos.map(seloCartao)}</ul>
        </Folha>
      )}

      {cbf ? <h2 className="so-posts">Posts</h2> : <div role="tablist" className="abas" onKeyDown={(e) => (e.key === 'ArrowRight' || e.key === 'ArrowLeft') && setAba(aba === 'posts' ? 'historico' : 'posts')}>
        {(['posts', 'historico'] as const).map((a) => (
          <button key={a} type="button" role="tab" aria-selected={aba === a} tabIndex={aba === a ? 0 : -1} onClick={() => setAba(a)}>{a === 'posts' ? 'Posts' : 'Histórico'}</button>
        ))}
      </div>}

      {aba === 'posts' && (
        <div role="tabpanel">
          {posts.estado === 'carregando' && <div className="grade-capas" aria-busy="true">{Array.from({ length: 12 }, (_, i) => <div key={i} className="esqueleto" />)}</div>}
          {posts.estado === 'erro' && (
            <div className="caixa-info" role="alert"><h2>Não deu para carregar os posts</h2><button type="button" className="botao secundario" onClick={posts.recarregar}>Tentar de novo</button></div>
          )}
          {posts.estado === 'ok' && posts.itens.length === 0 && (
            <div className="caixa-info">
              <h2>Ainda sem posts</h2>
              <p className="giz2">Quando o técnico publicar, os posts do clube aparecem aqui.</p>
              {meu && <Link para="/postar" className="botao">Novo post</Link>}
            </div>
          )}
          <GradeCapas posts={posts.itens} />
          {posts.erroMais && <div className="caixa-info" role="alert"><p>Não deu para carregar mais posts.</p><button type="button" className="botao secundario" onClick={posts.maisUm}>Tentar de novo</button></div>}
          <div ref={posts.fim} />
        </div>
      )}

      {aba === 'historico' && (
        <ol role="tabpanel" className="historico">
          {clube.historico.map((h) => (
            <li key={h.inicio + h.usuario.id}>
              <Inicial nome={h.usuario.nome} tam={40} />
              <div>
                <strong>{h.usuario.nome}</strong> {!h.fim && <span className="etiqueta-atual">Atual</span>}
                <div className="giz2 legenda-s">{h.fim ? `${data(h.inicio)} a ${data(h.fim)}` : `${data(h.inicio)} até hoje`}</div>
              </div>
            </li>
          ))}
          <p className="giz3 legenda-s">Os posts ficam no clube mesmo depois que o técnico sai.</p>
        </ol>
      )}
    </div>
  );
}
