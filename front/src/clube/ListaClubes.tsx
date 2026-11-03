import { useEffect, useState } from 'react';
import { api } from '../api/cliente';
import { Escudo } from '../feed/Escudo';
import { IcSeta } from '../feed/icones';
import { Link } from '../rotas';
import './clube.css';

type Linha = { id: string; nome: string; escudoUrl: string; tecnico: { id: string; nome: string } | null };

// /clubes: quem não tem clube chega por aqui pelo item Clube da barra
export function ListaClubes() {
  const [lista, setLista] = useState<Linha[] | 'carregando' | 'erro'>('carregando');
  const carregar = () => {
    setLista('carregando');
    api<Linha[]>('/clubes').then(setLista, () => setLista('erro'));
  };
  useEffect(carregar, []);
  return (
    <div className="clube">
      <h1 className="titulo-pagina">Clubes</h1>
      {lista === 'carregando' && <div aria-busy="true">{Array.from({ length: 8 }, (_, i) => <div key={i} className="esqueleto linha-esq" />)}</div>}
      {lista === 'erro' && (
        <div className="caixa-info" role="alert"><h2>Não deu para carregar os clubes</h2><button type="button" className="botao secundario" onClick={carregar}>Tentar de novo</button></div>
      )}
      {Array.isArray(lista) && (
        <ul className="lista-clubes">
          {lista.map((c) => (
            <li key={c.id}>
              <Link para={`/c/${c.id}`}>
                <Escudo src={c.escudoUrl} tam={44} />
                <span className="nome">{c.nome}</span>
                {c.tecnico ? <span className="giz2 legenda-s">Técnico: {c.tecnico.nome}</span> : <span className="vaga peq">Vaga aberta</span>}
                <IcSeta />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
