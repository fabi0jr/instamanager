import { useEffect, useState } from 'react';
import { api, ErroApi, type ClubeMini } from '../api/cliente';
import { data, Inicial } from '../clube/PerfilClube';
import { Escudo } from '../feed/Escudo';
import { GradeCapas } from '../feed/GradeCapas';
import { IcVoltar } from '../feed/icones';
import { sigla } from '../feed/siglas';
import type { Pagina, Post } from '../feed/tipos';
import { voltar } from '../rotas';
import { GradeConquistas, SeloNivel, type Conquista, type Nivel } from './Conquistas';
import '../clube/clube.css';
import './pessoa.css';

type Passagem = { clube: ClubeMini; inicio: string; fim: string | null };
type Pessoa = { id: string; nome: string; avatarUrl: string | null; clube: ClubeMini | null; historico: Passagem[]; posts: Pagina<Post>; nivel?: Nivel; conquistas?: Conquista[] };

// /u/:id (docs/design/pack3-onda-a.md §1): perfil público do técnico. Sem e-mail em lugar nenhum.
export function PerfilPessoa({ id }: { id: string }) {
  const [p, setP] = useState<Pessoa | 'carregando' | 'erro' | 'nao-achada'>('carregando');
  const [maisErro, setMaisErro] = useState(false);
  const [carregandoMais, setCarregandoMais] = useState(false);
  function carregar() {
    setP('carregando');
    api<Pessoa>(`/pessoas/${encodeURIComponent(id)}`).then(setP, (e) => setP(e instanceof ErroApi && e.status === 404 ? 'nao-achada' : 'erro'));
  }
  useEffect(carregar, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function mais() {
    if (typeof p !== 'object' || !p.posts.proximo || carregandoMais) return;
    setCarregandoMais(true);
    setMaisErro(false);
    try {
      const pg = await api<Pessoa>(`/pessoas/${encodeURIComponent(id)}?antes=${encodeURIComponent(p.posts.proximo)}`);
      setP((atual) => (typeof atual === 'object' ? { ...atual, posts: { itens: [...atual.posts.itens, ...pg.posts.itens], proximo: pg.posts.proximo } } : atual));
    } catch {
      setMaisErro(true);
    } finally {
      setCarregandoMais(false);
    }
  }

  const topo = <button type="button" className="voltar-pessoa" aria-label="Voltar" onClick={() => voltar('/')}><IcVoltar /></button>;
  if (p === 'carregando')
    return (
      <div className="pessoa" aria-busy="true">
        {topo}
        <div className="esqueleto" style={{ height: 88, width: 88, borderRadius: '50%', margin: '0 auto' }} />
        <div className="esqueleto" style={{ height: 40 }} />
        <div className="esqueleto" style={{ height: 56 }} />
        <div className="esqueleto" style={{ height: 56 }} />
        <div className="grade-capas">{Array.from({ length: 6 }, (_, i) => <div key={i} className="esqueleto" />)}</div>
      </div>
    );
  if (p === 'erro')
    return (
      <div className="pessoa">{topo}
        <div className="caixa-info" role="alert"><h2>Não deu para carregar o perfil</h2><button type="button" className="botao secundario" onClick={carregar}>Tentar de novo</button></div>
      </div>
    );
  if (p === 'nao-achada')
    return (
      <div className="pessoa">{topo}
        <div className="caixa-info" role="alert"><h2>Essa pessoa não está aqui</h2><p className="giz2">O link pode estar errado ou a conta ter saído do grupo.</p><button type="button" className="botao" onClick={() => voltar('/')}>Voltar ao feed</button></div>
      </div>
    );

  const desde = p.historico.at(-1)?.inicio; // o histórico vem do mais novo ao mais velho
  const primeiro = p.nome.split(' ')[0];
  return (
    <div className="pessoa">
      {topo}
      <header className="pessoa-topo">
        {p.avatarUrl ? <img className="avatar g" src={p.avatarUrl} alt="" /> : <Inicial nome={p.nome} tam={88} />}
        <h1>{p.nome}</h1>
        {p.clube ? <span className="pilula" aria-label={`Clube ${p.clube.nome}`}><Escudo src={p.clube.escudoUrl} tam={16} />{sigla(p.clube.id)}</span> : <span className="giz2 legenda-s">Torcedor, sem clube</span>}
        {desde && <span className="giz2 legenda-s">técnico desde {data(desde)}</span>}
      </header>

      {p.nivel && <SeloNivel nivel={p.nivel} />}
      {p.conquistas && <GradeConquistas conquistas={p.conquistas} />}

      <h2 className="secao-pessoa">Clubes por onde passou</h2>
      {p.historico.length === 0 ? (
        <p className="giz2 padrao-pessoa">Ainda não treinou nenhum clube.</p>
      ) : (
        <ul className="passagens">
          {p.historico.map((h) => (
            <li key={h.inicio + h.clube.id}>
              <Escudo src={h.clube.escudoUrl} tam={32} />
              <span><strong>{h.clube.nome}</strong><span className="giz2 legenda-s">{h.fim ? `${data(h.inicio)} a ${data(h.fim)}` : `${data(h.inicio)} até hoje`}</span></span>
            </li>
          ))}
        </ul>
      )}

      <h2 className="secao-pessoa">Posts · {p.posts.itens.length}{p.posts.proximo ? '+' : ''}</h2>
      {p.posts.itens.length === 0 ? (
        <div className="caixa-info"><h2>Ainda não tem post</h2><p className="giz2">Quando {primeiro} publicar, os posts aparecem aqui.</p></div>
      ) : (
        <GradeCapas posts={p.posts.itens} />
      )}
      {maisErro && <div className="caixa-info" role="alert"><p>Não deu para carregar mais posts.</p></div>}
      {p.posts.proximo && <button type="button" className="botao secundario mais-posts" disabled={carregandoMais} onClick={mais}>{maisErro ? 'Tentar de novo' : 'Ver mais posts'}</button>}
    </div>
  );
}
