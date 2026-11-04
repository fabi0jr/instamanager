import { useEffect, useState, type KeyboardEvent } from 'react';
import { api, ErroApi } from '../api/cliente';
import { Link } from '../rotas';
import { Escudo } from './Escudo';
import { Folha } from './Folha';
import { IcFechar } from './icones';
import { nomeDe } from './tipos';

type Pessoa = { id: string; nome: string; avatarUrl: string | null; clube: { id: string; nome: string; escudoUrl: string } | null };
type Grupo = { emoji: string; usuarios: Pessoa[] };

// Folha "Quem reagiu" (docs/design/onda-b.md §7): abas por emoji (só os que têm reação), linhas com a pessoa e o clube
export function QuemReagiu({ postId, aoFechar, aoIndisponivel }: { postId: string; aoFechar: () => void; aoIndisponivel: () => void }) {
  const [grupos, setGrupos] = useState<Grupo[] | 'carregando' | 'erro'>('carregando');
  const [aba, setAba] = useState('todas');
  function carregar() {
    setGrupos('carregando');
    api<Grupo[]>(`/posts/${postId}/reacoes`).then(setGrupos, (e) => {
      if (e instanceof ErroApi && e.status === 404) return aoIndisponivel(); // post oculto ou apagado: fecha e avisa
      setGrupos('erro');
    });
  }
  useEffect(carregar, [postId]); // eslint-disable-line react-hooks/exhaustive-deps

  const lista = Array.isArray(grupos) ? grupos : [];
  const total = lista.reduce((n, g) => n + g.usuarios.length, 0);
  const abas = [{ id: 'todas', rotulo: 'Todas', n: total }, ...lista.map((g) => ({ id: g.emoji, rotulo: g.emoji, n: g.usuarios.length }))];
  const linhas = lista.flatMap((g) => g.usuarios.map((u) => ({ ...u, emoji: g.emoji }))).filter((l) => aba === 'todas' || l.emoji === aba);
  const setas = (e: KeyboardEvent) => {
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!d) return;
    const i = abas.findIndex((a) => a.id === aba);
    const prox = abas[(i + d + abas.length) % abas.length];
    setAba(prox.id);
    queueMicrotask(() => document.getElementById('aba-reacao-' + prox.id)?.focus());
  };

  return (
    <Folha titulo="Reações" aoFechar={aoFechar} alta>
      <div className="alca" />
      <div className="folha-topo">
        <h2 tabIndex={-1} data-foco>Reações {Array.isArray(grupos) && <span className="giz2">{total}</span>}</h2>
        <button type="button" aria-label="Fechar" onClick={aoFechar}><IcFechar /></button>
      </div>
      {grupos === 'carregando' && <div aria-busy="true">{Array.from({ length: 6 }, (_, i) => <div key={i} className="esqueleto" style={{ height: 56, marginBottom: 4 }} />)}</div>}
      {grupos === 'erro' && (
        <div className="caixa-info" role="alert">
          <h2>Não deu para carregar a lista</h2>
          <button type="button" className="botao secundario" onClick={carregar}>Tentar de novo</button>
        </div>
      )}
      {Array.isArray(grupos) && (
        <>
          <div role="tablist" className="abas-emoji" onKeyDown={setas}>
            {abas.map((a) => (
              <button key={a.id} id={'aba-reacao-' + a.id} type="button" role="tab" aria-selected={aba === a.id} tabIndex={aba === a.id ? 0 : -1} onClick={() => setAba(a.id)}>
                {a.rotulo} <span>{a.n}</span>
              </button>
            ))}
          </div>
          <ul className="quem-lista" role="tabpanel">
            {linhas.map((l) => {
              const corpo = (
                <>
                  {l.avatarUrl ? <img className="av32" src={l.avatarUrl} alt="" width="40" height="40" /> : <span className="av32" aria-hidden="true">{l.nome[0]?.toUpperCase()}</span>}
                  <span className="quem-nome"><strong>{l.nome}</strong>{l.clube && <span className="giz2"><Escudo src={l.clube.escudoUrl} tam={14} /> {l.clube.nome}</span>}</span>
                  {aba === 'todas' && <span className="quem-emoji" aria-hidden="true">{l.emoji}</span>}
                </>
              );
              const rotulo = `${l.nome}${l.clube ? `, ${l.clube.nome}` : ''}, reagiu com ${nomeDe(l.emoji).toLowerCase()}`;
              return <li key={l.id + l.emoji}>{l.clube ? <Link para={`/c/${l.clube.id}`} aria-label={rotulo} onClick={aoFechar}>{corpo}</Link> : <div aria-label={rotulo} role="group">{corpo}</div>}</li>;
            })}
          </ul>
        </>
      )}
    </Folha>
  );
}
