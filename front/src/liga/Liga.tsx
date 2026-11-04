import { useEffect, useState, type KeyboardEvent } from 'react';
import { api, type Me } from '../api/cliente';
import { Escudo } from '../feed/Escudo';
import { IcOk } from '../feed/icones';
import { Link, navegar, useBusca } from '../rotas';
import { ListaVotacoes } from '../votacoes/Votacoes';
import { textoUltimos, type Linha, type Rodada } from './tipos';
import { Ultimos } from './Ultimos';
import './liga.css';

type Dados = { tabela: Linha[]; rodadas: Rodada[] };
const ABAS = [['tabela', 'Tabela'], ['rodadas', 'Rodadas'], ['votacoes', 'Votações']] as const;
type Aba = (typeof ABAS)[number][0];

function Tabela({ linhas, meuClube, sem }: { linhas: Linha[]; meuClube?: string; sem: boolean }) {
  return (
    <>
      {sem && (
        <div className="caixa-info">
          <h2>Nenhuma rodada fechada ainda</h2>
          <p className="giz2">A tabela começa a contar quando o admin fechar a primeira rodada. Por enquanto, os clubes aparecem em ordem alfabética.</p>
        </div>
      )}
      <p className="legenda-zonas giz2"><span className="zona topo" aria-hidden="true" /> Topo (4 primeiros) <span className="zona rebaixa" aria-hidden="true" /> Rebaixamento (4 últimos)</p>
      <div className="tabela-rolagem">
        <table className="tabela-liga">
          <thead>
            <tr>
              <th scope="col">#</th><th scope="col" className="col-clube">Clube</th>
              <th scope="col" aria-sort="descending">P</th><th scope="col">J</th><th scope="col">V</th><th scope="col" className="col-extra">E</th><th scope="col" className="col-extra">D</th>
              <th scope="col" className="col-extra">GP</th><th scope="col" className="col-extra">GC</th><th scope="col">SG</th><th scope="col">Últimos 5</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l, i) => {
              const zona = sem ? '' : i < 4 ? 'topo' : i >= linhas.length - 4 ? 'rebaixa' : '';
              return (
                <tr key={l.clubeId} className={`${zona} ${l.clubeId === meuClube ? 'meu' : ''}`} aria-label={`${l.posicao}º ${l.nome}, ${l.P} pontos, ${textoUltimos(l.ultimos)}`} onClick={() => navegar(`/c/${l.clubeId}`)}>
                  <th scope="row" className="pos">{l.posicao}</th>
                  <td className="col-clube"><Link para={`/c/${l.clubeId}`}><Escudo src={`/escudos/${l.clubeId}.svg`} tam={20} />{l.nome}</Link></td>
                  <td className="pontos">{l.P}</td><td>{l.J}</td><td>{l.V}</td><td className="col-extra">{l.E}</td><td className="col-extra">{l.D}</td>
                  <td className="col-extra">{l.GP}</td><td className="col-extra">{l.GC}</td><td>{l.SG}</td><td><Ultimos valores={l.ultimos} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Rodadas({ rodadas, inicial }: { rodadas: Rodada[]; inicial: number }) {
  const [n, setN] = useState(inicial);
  const r = rodadas.find((x) => x.numero === n) ?? rodadas[0];
  if (!r) return <p className="giz2 padrao">Nenhuma rodada ainda.</p>;
  return (
    <>
      <div className="chips-rodada" role="group" aria-label="Rodadas">
        {rodadas.map((x) => <button key={x.numero} type="button" aria-pressed={x.numero === n} aria-label={`Rodada ${x.numero}`} onClick={() => setN(x.numero)}>{x.numero}</button>)}
      </div>
      <div className="rodada-topo">
        <h2>Rodada {r.numero}</h2>
        {r.fechada ? <span className="etiqueta fechada"><IcOk /> Fechada</span> : <span className="etiqueta aberta">Em andamento</span>}
      </div>
      {!r.fechada && r.jogos.length > 0 && <p className="giz2 padrao">Placar parcial. Só vale na tabela depois que o admin fechar a rodada.</p>}
      {r.jogos.length === 0 && <p className="giz2 padrao">Faltam jogos a lançar</p>}
      <ul className={`jogos ${r.fechada ? '' : 'parcial'}`}>
        {r.jogos.map((j) => {
          const m = j.golsMandante, v = j.golsVisitante;
          return (
            <li key={j.id} aria-label={`${j.mandante.nome} ${m}, ${j.visitante.nome} ${v}`}>
              <span className={`time mandante ${m > v ? 'ganhou' : m < v ? 'perdeu' : ''}`}>{j.mandante.nome}</span>
              <Escudo src={j.mandante.escudoUrl} tam={22} />
              <strong className="placar">{m} × {v}</strong>
              <Escudo src={j.visitante.escudoUrl} tam={22} />
              <span className={`time ${v > m ? 'ganhou' : v < m ? 'perdeu' : ''}`}>{j.visitante.nome}</span>
            </li>
          );
        })}
      </ul>
    </>
  );
}

// /liga: Tabela · Rodadas (docs/design/onda-b.md §2). A rodada atual é a última fechada.
export function Liga({ me }: { me: Me }) {
  const [dados, setDados] = useState<Dados | 'carregando' | 'erro'>('carregando');
  const [aba, setAba] = useState<Aba>(useBusca().get('aba') === 'votacoes' ? 'votacoes' : 'tabela');
  function carregar() {
    setDados('carregando');
    Promise.all([api<Linha[]>('/liga/tabela'), api<Rodada[]>('/liga/rodadas')]).then(([tabela, rodadas]) => setDados({ tabela, rodadas }), () => setDados('erro'));
  }
  useEffect(carregar, []);
  const setas = (e: KeyboardEvent) => {
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (d) setAba(ABAS[(ABAS.findIndex(([id]) => id === aba) + d + ABAS.length) % ABAS.length][0]);
  };

  const fechadas = dados === 'carregando' || dados === 'erro' ? [] : dados.rodadas.filter((r) => r.fechada);
  const atual = fechadas.at(-1)?.numero;
  return (
    <div className="tela liga">
      <h1>Liga</h1>
      <p className="giz2">{atual ? `Rodada ${atual} de 38 · só rodadas fechadas contam` : 'Só rodadas fechadas contam'}</p>
      <div role="tablist" className="abas-liga" onKeyDown={setas}>
        {ABAS.map(([id, nome]) => <button key={id} type="button" role="tab" aria-selected={aba === id} tabIndex={aba === id ? 0 : -1} onClick={() => setAba(id)}>{nome}</button>)}
      </div>
      {aba === 'votacoes' && <div role="tabpanel"><ListaVotacoes /></div>}
      {aba !== 'votacoes' && dados === 'carregando' && <div role="tabpanel" aria-busy="true">{Array.from({ length: 16 }, (_, i) => <div key={i} className="esqueleto linha-esq-liga" />)}</div>}
      {aba !== 'votacoes' && dados === 'erro' && (
        <div className="caixa-info" role="alert">
          <h2>Não deu para carregar a tabela</h2>
          <button type="button" className="botao secundario" onClick={carregar}>Tentar de novo</button>
        </div>
      )}
      {aba !== 'votacoes' && typeof dados === 'object' && (
        <div role="tabpanel">
          {aba === 'tabela' && <Tabela linhas={dados.tabela} meuClube={me.clube?.id} sem={fechadas.length === 0} />}
          {aba === 'rodadas' && <Rodadas rodadas={dados.rodadas} inicial={atual ?? dados.rodadas[0]?.numero ?? 1} />}
        </div>
      )}
    </div>
  );
}
