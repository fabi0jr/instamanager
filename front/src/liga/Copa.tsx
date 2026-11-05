import { useEffect, useState } from 'react';
import { api, type ClubeMini } from '../api/cliente';
import { Escudo } from '../feed/Escudo';
import { Icone, IcOk } from '../feed/icones';
import { sigla } from '../feed/siglas';
import { diaHora } from './prazo';

export type JogoCopa = {
  id: string; mandante: ClubeMini; visitante: ClubeMini;
  golsMandante: number | null; golsVisitante: number | null; penaltisMandante: number | null; penaltisVisitante: number | null;
  vencedor: ClubeMini | null;
};
export type FaseCopa = {
  fase: { id: string; nome: string; ordem: number; prazoPalpite: string | null; fechada: boolean; resumoPublicado?: boolean; resumoPostId?: string | null };
  jogos: JogoCopa[];
};

function Lado({ clube, gols, penaltis, j }: { clube: ClubeMini; gols: number | null; penaltis: number | null; j: JogoCopa }) {
  const passou = j.vencedor?.id === clube.id;
  const eliminado = !!j.vencedor && !passou;
  return (
    <div className={`lado-copa ${passou ? 'passou' : ''} ${eliminado ? 'eliminado' : ''}`}>
      <Escudo src={clube.escudoUrl} tam={28} />
      <span className="sigla-copa" title={clube.nome}>{sigla(clube.id)}</span>
      {passou && <><IcOk /><span className="sr">{clube.nome} passou</span></>}
      {eliminado && <span className="sr">{clube.nome} eliminado</span>}
      {penaltis !== null && <span className="penaltis">({penaltis})</span>}
      <span className="gols-copa">{gols ?? ''}</span>
    </div>
  );
}

export function CardConfronto({ j }: { j: JogoCopa }) {
  const nome = `${j.mandante.nome} contra ${j.visitante.nome}`;
  const pen = j.penaltisMandante !== null && j.penaltisVisitante !== null && j.vencedor;
  return (
    <div>
      <article className="card-copa" aria-label={nome}>
        <Lado clube={j.mandante} gols={j.golsMandante} penaltis={j.penaltisMandante} j={j} />
        <Lado clube={j.visitante} gols={j.golsVisitante} penaltis={j.penaltisVisitante} j={j} />
      </article>
      {pen && <p className="nota-penaltis giz2">{j.vencedor!.nome} passou nos pênaltis</p>}
    </div>
  );
}

// Liga › Copa: a chave por fases, da mais antiga para a mais nova (docs/design/pack3-onda-a.md §3)
export function Copa() {
  const [fases, setFases] = useState<FaseCopa[] | 'carregando' | 'erro'>('carregando');
  function carregar() {
    setFases('carregando');
    api<FaseCopa[]>('/copa').then((l) => setFases(Array.isArray(l) ? l : []), () => setFases('erro'));
  }
  useEffect(carregar, []);
  if (fases === 'carregando') return <div role="tabpanel" aria-busy="true"><div className="esqueleto" style={{ height: 28, width: 160 }} /><div className="esqueleto" style={{ height: 100, marginTop: 8 }} /><div className="esqueleto" style={{ height: 100, marginTop: 8 }} /></div>;
  if (fases === 'erro')
    return (
      <div role="alert" className="caixa-info">
        <h2>Não deu para carregar a Copa</h2>
        <button type="button" className="botao secundario" onClick={carregar}>Tentar de novo</button>
      </div>
    );
  if (fases.length === 0)
    return (
      <div role="tabpanel" className="caixa-info">
        <Icone nome="chave" />
        <h2>A Copa ainda não começou</h2>
        <p className="giz2">Quando o admin criar a primeira fase, a chave aparece aqui.</p>
      </div>
    );
  return (
    <div role="tabpanel">
      {fases.map(({ fase, jogos }) => (
        <section key={fase.id} className="fase-copa" aria-label={fase.nome}>
          <h2>{fase.nome}</h2>
          <p className="estado-fase giz2">
            {fase.fechada ? <><IcOk /> Fechada · jogo único</> : fase.prazoPalpite ? <><Icone nome="relogio" /> Palpite até {diaHora(fase.prazoPalpite)}</> : <>Aberta · sem prazo de palpite</>}
          </p>
          {jogos.length === 0 ? <p className="giz2">Confrontos ainda não lançados.</p> : <div className="cards-copa">{jogos.map((j) => <CardConfronto key={j.id} j={j} />)}</div>}
        </section>
      ))}
      <p className="giz3 legenda-s">Semifinal e final aparecem quando o admin criar a fase.</p>
    </div>
  );
}
