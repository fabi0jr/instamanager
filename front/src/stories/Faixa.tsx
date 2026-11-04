import { useEffect, useState } from 'react';
import { api, type Me } from '../api/cliente';
import { Escudo } from '../feed/Escudo';
import { Link } from '../rotas';
import type { FaixaClube } from './tipos';
import './stories.css';

// Ordem (docs/design/onda-c.md §5.1): Seu story, CBF, clubes com story não visto (mais novo primeiro), depois os vistos
export function ordenar(lista: FaixaClube[], meuClube?: string) {
  const novo = (f: FaixaClube) => f.stories.reduce((m, s) => (s.criadoEm > m ? s.criadoEm : m), '');
  const porData = (a: FaixaClube, b: FaixaClube) => novo(b).localeCompare(novo(a));
  const outros = lista.filter((f) => f.clube.id !== meuClube && f.clube.id !== 'cbf');
  return [
    ...lista.filter((f) => f.clube.id === meuClube && f.clube.id !== 'cbf'),
    ...lista.filter((f) => f.clube.id === 'cbf'),
    ...outros.filter((f) => !f.todosVistos).sort(porData),
    ...outros.filter((f) => f.todosVistos).sort(porData),
  ];
}

export function Bolinha({ f, meu, novo }: { f: FaixaClube; meu: boolean; novo?: string }) {
  const cbf = f.clube.id === 'cbf';
  return (
    <li className="item-bolinha">
      {/* o + é um link irmão (não aninhado): tocar nele cria, tocar na bolinha abre */}
      {novo && <Link para={novo} className="mais-story" aria-label={cbf ? 'Novo story da CBF' : 'Novo story'}><span aria-hidden="true">+</span></Link>}
      <Link para={`/stories/${f.clube.id}`} className="bolinha" aria-label={`${meu ? 'Seu story' : `Story de ${f.clube.nome}`}${f.todosVistos ? ', já visto' : ', novo'}`}>
        <span className={`anel ${f.todosVistos ? 'visto' : ''}`}>{cbf ? <img src="/escudos/cbf.svg" alt="" width="32" height="44" /> : <Escudo src={f.clube.escudoUrl} tam={48} />}</span>
        <span className="nome-bolinha">{meu ? 'Seu story' : f.clube.nome}</span>
      </Link>
    </li>
  );
}

export function FaixaStories({ me }: { me: Me }) {
  const [lista, setLista] = useState<FaixaClube[] | 'carregando' | 'erro'>('carregando');
  useEffect(() => {
    api<FaixaClube[]>('/stories').then((l) => setLista(Array.isArray(l) ? l : []), () => setLista('erro'));
  }, []);
  if (lista === 'erro') return null; // o feed segue sem a faixa
  if (lista === 'carregando') return <div className="faixa-stories" aria-busy="true">{Array.from({ length: 5 }, (_, i) => <span key={i} className="esqueleto bolinha-esq" />)}</div>;
  const meuClube = me.clube?.id;
  const meuStory = lista.find((f) => f.clube.id === meuClube);
  const cbfStory = lista.find((f) => f.clube.id === 'cbf');
  if (!lista.length && !meuClube && !me.isAdmin) return null;
  const resto = ordenar(lista, meuClube);
  const novoDe = (f: FaixaClube) => (f.clube.id === meuClube ? '/stories/novo' : me.isAdmin && f.clube.id === 'cbf' ? '/stories/novo?cbf=1' : undefined);
  return (
    <ul className="faixa-stories" aria-label="Stories">
      {meuClube && !meuStory && (
        <li>
          <Link para="/stories/novo" className="bolinha" aria-label="Criar story">
            <span className="anel vazio"><Escudo src={me.clube!.escudoUrl} tam={48} /><span className="mais-visual" aria-hidden="true">+</span></span>
            <span className="nome-bolinha">Seu story</span>
          </Link>
        </li>
      )}
      {me.isAdmin && !cbfStory && (
        <li>
          <Link para="/stories/novo?cbf=1" className="bolinha" aria-label="Criar story da CBF">
            <span className="anel vazio"><img src="/escudos/cbf.svg" alt="" width="32" height="44" /><span className="mais-visual" aria-hidden="true">+</span></span>
            <span className="nome-bolinha">Story da CBF</span>
          </Link>
        </li>
      )}
      {resto.map((f) => <Bolinha key={f.clube.id} f={f} meu={f.clube.id === meuClube} novo={novoDe(f)} />)}
    </ul>
  );
}
