import { useEffect, useState } from 'react';
import type { ClubeMini } from '../api/cliente';
import { api } from '../api/cliente';
import { Escudo } from '../feed/Escudo';
import { Icone } from '../feed/icones';
import { sigla } from '../feed/siglas';
import { Link } from '../rotas';
import { diaHora, emMenosDe24h, faltam } from './prazo';

export type JogoCal = {
  tipo: 'BRASILEIRAO' | 'COPA'; id: string; rodada: number | null; fase: { id: string; nome: string } | null;
  prazoPalpite: string | null; mandante: ClubeMini; visitante: ClubeMini;
};

export function LinhaJogo({ j, legenda, para }: { j: { mandante: ClubeMini; visitante: ClubeMini }; legenda: string; para?: string }) {
  const corpo = (
    <>
      <span className="lado"><Escudo src={j.mandante.escudoUrl} tam={36} /><b>{sigla(j.mandante.id)}</b></span>
      <span className="centro-jogo"><span className="x">×</span><span className="giz2 legenda-s">{legenda}</span></span>
      <span className="lado visitante"><b>{sigla(j.visitante.id)}</b><Escudo src={j.visitante.escudoUrl} tam={36} /></span>
    </>
  );
  const nome = `${j.mandante.nome} contra ${j.visitante.nome}`;
  return para ? <Link para={para} className="linha-jogo" aria-label={`${nome}, ${legenda}`}>{corpo}</Link> : <div className="linha-jogo" role="group" aria-label={nome}>{corpo}</div>;
}

// Liga › Calendário: só jogos sem placar, agrupados por rodada ou fase (docs/design/pack3-onda-a.md §2)
export function Calendario() {
  const [lista, setLista] = useState<JogoCal[] | 'carregando' | 'erro'>('carregando');
  function carregar() {
    setLista('carregando');
    api<JogoCal[]>('/liga/calendario').then((l) => setLista(Array.isArray(l) ? l : []), () => setLista('erro'));
  }
  useEffect(carregar, []);
  if (lista === 'carregando') return <div role="tabpanel" aria-busy="true"><div className="esqueleto" style={{ height: 150 }} /><div className="esqueleto" style={{ height: 150, marginTop: 8 }} /></div>;
  if (lista === 'erro')
    return (
      <div role="alert" className="caixa-info">
        <h2>Não deu para carregar o calendário</h2>
        <button type="button" className="botao secundario" onClick={carregar}>Tentar de novo</button>
      </div>
    );
  if (lista.length === 0)
    return (
      <div role="tabpanel" className="caixa-info">
        <h2>Nenhum jogo marcado</h2>
        <p className="giz2">Quando o admin lançar a próxima rodada ou uma fase da Copa, os jogos aparecem aqui.</p>
      </div>
    );
  const grupos: { chave: string; titulo: string; prazo: string | null; jogos: JogoCal[]; para: string }[] = [];
  for (const j of lista) {
    const chave = j.tipo === 'COPA' ? `c${j.fase?.id}` : `b${j.rodada}`;
    let g = grupos.find((x) => x.chave === chave);
    if (!g) {
      g = j.tipo === 'COPA'
        ? { chave, titulo: `Copa do Brasil · ${j.fase?.nome ?? ''}`, prazo: j.prazoPalpite, jogos: [], para: `/liga?aba=bolao&fase=${j.fase?.id}` }
        : { chave, titulo: `Brasileirão · rodada ${j.rodada}`, prazo: j.prazoPalpite, jogos: [], para: `/liga?aba=bolao&rodada=${j.rodada}` };
      grupos.push(g);
    }
    g.jogos.push(j);
  }
  return (
    <div role="tabpanel">
      {grupos.map((g) => (
        <section key={g.chave} className="grupo-cal" aria-label={g.titulo}>
          <h2>{g.titulo}</h2>
          {g.prazo && faltam(g.prazo) && (
            <p className={`prazo-linha ${emMenosDe24h(g.prazo) ? 'correndo' : 'giz2'}`}><Icone nome="relogio" /> Palpite até {diaHora(g.prazo)}</p>
          )}
          <div className="jogos-cal">{g.jogos.map((j) => <LinhaJogo key={j.id} j={j} legenda={j.tipo === 'COPA' ? 'Jogo único' : 'Palpitar'} para={g.para} />)}</div>
        </section>
      ))}
      <p className="dica-cal"><Icone nome="bola" /> Na Copa, empate vai para os pênaltis. Quem passa também vale ponto.</p>
    </div>
  );
}
