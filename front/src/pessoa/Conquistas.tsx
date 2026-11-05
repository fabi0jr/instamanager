import { data } from '../clube/PerfilClube';
import { Icone } from '../feed/icones';
import { Link } from '../rotas';

export type Nivel = { xp: number; nome: string; min: number; proximo: number | null };
export type Conquista = { tipo: string; nome: string; vezes: number; ultimaEm: string };

const NOME_NIVEL: Record<number, string> = { 100: 'Auxiliar', 300: 'Técnico', 700: 'Professor', 1500: 'Lenda' };

// docs/design/pack3-onda-b.md §1: selo de nível (no /perfil o card leva ao perfil público)
export function SeloNivel({ nivel, para }: { nivel: Nivel; para?: string }) {
  const { xp, nome, min, proximo } = nivel;
  const total = proximo === null ? 1 : proximo - min;
  const dentro = proximo === null ? 1 : xp - min;
  const pct = Math.min(100, Math.max(0, Math.round((dentro / total) * 100)));
  const corpo = (
    <>
      <div className="nivel-linha"><Icone nome="nivel" /><span className="nivel-nome">{nome}</span><span className="nivel-xp">{xp} XP</span></div>
      <div className="nivel-trilho" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={dentro} aria-label={proximo === null ? `${nome}, ${xp} XP` : `${nome}, ${xp} de ${proximo} XP`}>
        <div className="nivel-cheio" style={{ width: `${pct}%` }} />
      </div>
      <span className="giz2 legenda-s">{proximo === null ? 'Nível máximo' : `Faltam ${proximo - xp} XP para ${NOME_NIVEL[proximo] ?? 'o próximo nível'}`}</span>
    </>
  );
  return para ? <Link para={para} className="nivel-selo">{corpo}</Link> : <div className="nivel-selo">{corpo}</div>;
}

// ordem fixa e regra de cada uma (§2)
const CONQUISTAS = [
  ['PRIMEIRA_VITORIA', 'Primeira vitória', 'bola', 'Vença seu primeiro jogo.'],
  ['GOLEADA', 'Goleada', 'estrela', 'Vença por 3 gols ou mais.'],
  ['INVICTO_5', 'Invicto', 'escudo', '5 jogos seguidos sem perder.'],
  ['LIDER', 'Líder', 'liga', 'Feche uma rodada em 1º.'],
  ['CAMPEAO_COPA', 'Campeão da Copa', 'trofeu', 'Vença a final da Copa.'],
  ['REI_BOLAO', 'Rei do bolão', 'bandeira', 'Maior pontuação numa rodada ou fase.'],
  ['PRIMEIRO_STORY', 'Primeiro story', 'camera', 'Publique seu primeiro story.'],
  ['COMUNICADOR', 'Comunicador', 'comentar', 'Publique 100 posts.'],
] as const;

export function GradeConquistas({ conquistas }: { conquistas: Conquista[] }) {
  const tenho = new Map(conquistas.map((c) => [c.tipo, c]));
  const n = CONQUISTAS.filter(([tipo]) => tenho.has(tipo)).length;
  return (
    <>
      <h2 className="secao-pessoa">Conquistas · {n} de {CONQUISTAS.length}</h2>
      <ul className="conquistas">
        {CONQUISTAS.map(([tipo, nome, icone, regra]) => {
          const c = tenho.get(tipo);
          return (
            <li key={tipo} className={c ? 'conq ganha' : 'conq'} aria-disabled={c ? undefined : true}>
              <Icone nome={icone} />
              {c && c.vezes > 1 && <span className="conq-vezes">×{c.vezes}</span>}
              <span className="conq-nome">{nome}</span>
              <span className="giz2 legenda-s">{c ? `em ${data(c.ultimaEm)}` : regra}</span>
            </li>
          );
        })}
      </ul>
      {n === 0 && <p className="giz2 padrao-pessoa">Poste, vença e palpite para ganhar a primeira.</p>}
    </>
  );
}
