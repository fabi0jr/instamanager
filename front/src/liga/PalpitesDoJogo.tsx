import { useEffect, useState } from 'react';
import { api, type ClubeMini } from '../api/cliente';
import { Escudo } from '../feed/Escudo';
import { Icone, IcVoltar } from '../feed/icones';
import { sigla } from '../feed/siglas';
import { voltar } from '../rotas';
import type { FaseCopa } from './Copa';
import { diaHora } from './prazo';
import type { Rodada } from './tipos';
import './liga.css';

type Palpite = { usuario: { id: string; nome: string; avatarUrl: string | null }; golsMandante: number; golsVisitante: number; classificadoId: string | null; pontos: number | null; exato: boolean };
type Jogo = { mandante: ClubeMini; visitante: ClubeMini; gm: number | null; gv: number | null; prazo: string | null };

// /bolao/jogo/:tipo/:id: os palpites de todos, só depois do prazo (docs/design/pack3-onda-a.md §5)
export function PalpitesDoJogo({ tipo, id }: { tipo: string; id: string }) {
  const [d, setD] = useState<{ jogo: Jogo; lista: Palpite[] } | 'carregando' | 'erro'>('carregando');
  function carregar() {
    setD('carregando');
    const copa = tipo === 'copa';
    Promise.all([api<Palpite[]>(`/bolao/jogo/${tipo}/${encodeURIComponent(id)}`), copa ? api<FaseCopa[]>('/copa') : api<Rodada[]>('/liga/rodadas')]).then(
      ([lista, fonte]) => {
        let jogo: Jogo | undefined;
        if (copa) for (const { fase, jogos } of fonte as FaseCopa[]) { const j = jogos.find((x) => x.id === id); if (j) jogo = { mandante: j.mandante, visitante: j.visitante, gm: j.golsMandante, gv: j.golsVisitante, prazo: fase.prazoPalpite }; }
        else for (const r of fonte as Rodada[]) { const j = r.jogos.find((x) => x.id === id); if (j) jogo = { mandante: j.mandante, visitante: j.visitante, gm: j.golsMandante, gv: j.golsVisitante, prazo: r.prazoPalpite ?? null }; }
        if (!jogo) throw new Error('sem jogo');
        setD({ jogo, lista });
      },
      () => setD('erro'),
    );
  }
  useEffect(carregar, [tipo, id]); // eslint-disable-line react-hooks/exhaustive-deps

  const topo = <header className="topo-palpites"><button type="button" aria-label="Voltar" onClick={() => voltar('/liga?aba=bolao')}><IcVoltar /></button><h1>Palpites do jogo</h1></header>;
  if (d === 'carregando') return <div className="tela liga" aria-busy="true">{topo}<div className="esqueleto" style={{ height: 88 }} /><div className="esqueleto" style={{ height: 64, marginTop: 8 }} /></div>;
  if (d === 'erro') return <div className="tela liga">{topo}<div className="caixa-info" role="alert"><h2>Não deu para carregar os palpites</h2><button type="button" className="botao secundario" onClick={carregar}>Tentar de novo</button></div></div>;

  const { jogo, lista } = d;
  const passado = !!jogo.prazo && new Date(jogo.prazo).getTime() <= Date.now();
  const sorted = [...lista].sort((a, b) => (b.pontos ?? 0) - (a.pontos ?? 0) || a.usuario.nome.localeCompare(b.usuario.nome, 'pt-BR'));
  const tem = jogo.gm !== null && jogo.gv !== null;
  const nomeDe = (cid: string | null) => [jogo.mandante, jogo.visitante].find((c) => c.id === cid)?.nome;
  return (
    <div className="tela liga palpites-jogo">
      {topo}
      <div className="cartao-jogo-resultado">
        <span className="lado"><Escudo src={jogo.mandante.escudoUrl} tam={36} /><b>{sigla(jogo.mandante.id)}</b></span>
        <span className="resultado">{tem ? <><strong>{jogo.gm} × {jogo.gv}</strong><span className="giz2 legenda-s">resultado final</span></> : <span className="giz2 legenda-s">sem resultado ainda</span>}</span>
        <span className="lado visitante"><b>{sigla(jogo.visitante.id)}</b><Escudo src={jogo.visitante.escudoUrl} tam={36} /></span>
      </div>
      {!passado && (
        <p className="faixa-prazo" role="status"><Icone nome="cadeado" />{jogo.prazo ? `Os palpites dos outros aparecem depois do prazo, ${diaHora(jogo.prazo)}.` : 'Os palpites dos outros aparecem depois que o admin definir o prazo e ele passar.'}</p>
      )}
      <h2 className="secao-pessoa">{passado ? 'Palpite de cada um' : 'Seu palpite'}</h2>
      {sorted.length === 0 ? <p className="giz2">{passado ? 'Ninguém palpitou neste jogo.' : 'Você ainda não palpitou neste jogo.'}</p> : (
        <ul className="lista-palpites">
          {sorted.map((p) => (
            <li key={p.usuario.id} className="linha-pessoa">
              {p.usuario.avatarUrl ? <img className="av36" src={p.usuario.avatarUrl} alt="" width="36" height="36" /> : <span className="av36" aria-hidden="true">{p.usuario.nome[0]?.toUpperCase()}</span>}
              <span className="nome-palpite"><strong>{p.usuario.nome}</strong>{p.classificadoId && <span className="giz2 legenda-s">passa: {nomeDe(p.classificadoId)}</span>}</span>
              <span className="palpite-valor">{p.golsMandante} × {p.golsVisitante}</span>
              {tem && p.pontos !== null && <span className={`chip-pontos ${p.pontos > 0 ? 'ganhou' : ''}`} aria-label={`${p.pontos} ${p.pontos === 1 ? 'ponto' : 'pontos'}`}>{p.pontos > 0 ? `+${p.pontos}` : p.pontos}</span>}
            </li>
          ))}
        </ul>
      )}
      {passado && !tem && sorted.length > 0 && <p className="giz2">Os pontos aparecem quando o admin lançar o placar.</p>}
      <p className="giz3 legenda-s">Placar exato vale 3, vencedor ou empate certo vale 1.</p>
    </div>
  );
}
