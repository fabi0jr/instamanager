import { useEffect, useState, type KeyboardEvent } from 'react';
import { Escudo } from '../feed/Escudo';
import { Icone } from '../feed/icones';
import { sigla } from '../feed/siglas';
import { haQuanto, type Post } from '../feed/tipos';
import { usePaginado } from '../paginado';
import { Link, voltar } from '../rotas';
import { semMarcas } from '../mencoes/mencoes';
import { Destaque } from './destaque';
import '../liga/liga.css';
import './busca.css';

const ABAS = [['posts', 'Posts'], ['prompts', 'Prompts'], ['clubes', 'Clubes'], ['pessoas', 'Pessoas']] as const;
type Aba = (typeof ABAS)[number][0];
type Prompt = { imagemId: string; postId: string; miniUrl: string; prompt: string; clube?: { nome: string } };
type ClubeBusca = { id: string; nome: string; escudoUrl: string; tecnico?: { id: string; nome: string } | null };
type Pessoa = { id: string; nome: string; avatarUrl: string | null; clube: { id: string; nome: string; escudoUrl: string } | null };

function Linha({ aba, item, q }: { aba: Aba; item: unknown; q: string }) {
  if (aba === 'posts') {
    const p = item as Post;
    const corpo = semMarcas(p.texto ?? p.legenda, p.mencoes); // nome do banco, nunca o markup nem o nome escrito no texto
    return (
      <Link para={`/p/${p.id}`} className="res-linha">
        {p.imagens[0] ? <img className="res-mini" src={p.imagens[0].miniUrl} alt="" width="64" height="64" /> : <span className="res-mini"><Escudo src={p.clube.escudoUrl} tam={40} /></span>}
        <span className="res-corpo"><strong className="res-titulo">{p.clube.nome}</strong><span className="res-texto"><Destaque texto={corpo} q={q} /></span><span className="giz2 legenda-s">{haQuanto(p.criadoEm)}</span></span>
      </Link>
    );
  }
  if (aba === 'prompts') {
    const p = item as Prompt;
    return (
      <Link para={`/galeria?imagem=${p.imagemId}&post=${p.postId}`} className="res-linha">
        {p.miniUrl ? <img className="res-mini" src={p.miniUrl} alt="" width="64" height="64" /> : <span className="res-mini"><Icone nome="galeria" /></span>}
        <span className="res-corpo"><span className="res-texto"><Destaque texto={p.prompt} q={q} /></span>{p.clube && <span className="giz2 legenda-s">{p.clube.nome}</span>}</span>
        <Icone nome="seta" />
      </Link>
    );
  }
  if (aba === 'clubes') {
    const c = item as ClubeBusca;
    return (
      <Link para={`/c/${c.id}`} className="res-linha">
        <Escudo src={c.escudoUrl} tam={44} />
        <span className="res-corpo"><strong className="res-titulo"><Destaque texto={c.nome} q={q} /></strong><span className="giz2 legenda-s">{c.tecnico ? `técnico ${c.tecnico.nome}` : 'vaga aberta'}</span></span>
        <Icone nome="seta" />
      </Link>
    );
  }
  const p = item as Pessoa;
  const corpo = (
    <>
      {p.avatarUrl ? <img className="av44" src={p.avatarUrl} alt="" width="44" height="44" /> : <span className="av44" aria-hidden="true">{p.nome[0]?.toUpperCase()}</span>}
      <span className="res-corpo"><strong className="res-titulo"><Destaque texto={p.nome} q={q} /></strong></span>
      {p.clube ? <span className="pilula"><Escudo src={p.clube.escudoUrl} tam={14} />{sigla(p.clube.id)}</span> : <span className="pilula">torcedor</span>}
    </>
  );
  return <Link para={`/u/${p.id}`} className="res-linha">{corpo}</Link>;
}

// só existe com 2 caracteres ou mais: montar este componente é o que chama a API
function Resultados({ aba, q }: { aba: Aba; q: string }) {
  const lista = usePaginado<unknown>('/busca', { q, tipo: aba });
  return (
    <div role="tabpanel" aria-label={ABAS.find(([id]) => id === aba)![1]}>
      {lista.estado === 'carregando' && <div aria-busy="true">{Array.from({ length: 5 }, (_, i) => <div key={i} className="esqueleto" style={{ height: 72, marginBottom: 4 }} />)}</div>}
      {lista.estado === 'erro' && <div className="caixa-info" role="alert"><h2>Não deu para buscar</h2><button type="button" className="botao secundario" onClick={lista.recarregar}>Tentar de novo</button></div>}
      {lista.estado === 'ok' && lista.itens.length === 0 && <div className="caixa-info"><h2>Nada achado para “{q}”</h2><p className="giz2">Tente outra palavra. A busca ignora acento e maiúscula.</p></div>}
      <ul className="res-lista">{lista.itens.map((it, i) => <li key={i}><Linha aba={aba} item={it} q={q} /></li>)}</ul>
      {lista.erroMais && <div className="caixa-info" role="alert"><p>Não deu para carregar mais.</p><button type="button" className="botao secundario" onClick={lista.maisUm}>Tentar de novo</button></div>}
      <div ref={lista.fim} />
    </div>
  );
}

// /busca (docs/design/onda-c.md §4): abas Posts · Prompts · Clubes · Pessoas; dispara com 2+ caracteres, 300 ms depois da última tecla
export function Busca() {
  const [texto, setTexto] = useState('');
  const [q, setQ] = useState('');
  const [aba, setAba] = useState<Aba>('posts');
  useEffect(() => {
    const t = setTimeout(() => setQ(texto.trim().slice(0, 60)), 300);
    return () => clearTimeout(t);
  }, [texto]);
  const setas = (e: KeyboardEvent) => {
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (d) setAba(ABAS[(ABAS.findIndex(([id]) => id === aba) + d + ABAS.length) % ABAS.length][0]);
  };
  const curto = texto.trim().length < 2;
  return (
    <div className="tela busca">
      <div className="busca-topo">
        <label className="busca-campo">
          <Icone nome="busca" />
          <input type="search" autoFocus maxLength={60} placeholder="Buscar" aria-label="Buscar" value={texto} onChange={(e) => setTexto(e.target.value)} />
          {texto && <button type="button" aria-label="Limpar" onClick={() => setTexto('')}><Icone nome="fechar" /></button>}
        </label>
        <button type="button" className="link" onClick={() => voltar('/')}>Cancelar</button>
      </div>
      <div role="tablist" className="abas-liga" onKeyDown={setas}>
        {ABAS.map(([id, nome]) => <button key={id} type="button" role="tab" aria-selected={aba === id} tabIndex={aba === id ? 0 : -1} onClick={() => setAba(id)}>{nome}</button>)}
      </div>
      {curto && texto.trim().length === 0 && <div className="caixa-info"><h2>Digite ao menos 2 letras</h2><p className="giz2">A busca olha legendas e textos de posts, prompts, clubes e pessoas.</p></div>}
      {curto && texto.trim().length === 1 && <p className="aviso-ambar" role="status">Falta mais uma letra para buscar.</p>}
      {!curto && q.length >= 2 && <Resultados key={aba + q} aba={aba} q={q} />}
    </div>
  );
}
