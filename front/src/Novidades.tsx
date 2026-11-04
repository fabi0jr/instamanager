import { useState } from 'react';
import { Folha } from './feed/Folha';
import { jaViuNovidades, marcarNovidadesVistas, NOVIDADES } from './novidades';
import { emEdicao } from './rotas';

// Fica fechado em cima da instalação/avisos e das telas de edição (nada a interromper); abre quando a pessoa sai delas.
export function Novidades({ caminho }: { caminho: string }) {
  const [fechado, setFechado] = useState(false);
  if (fechado || jaViuNovidades() || caminho === '/instalar' || caminho === '/avisos' || emEdicao(caminho)) return null;
  const fechar = () => {
    marcarNovidadesVistas(); // qualquer jeito de fechar conta: é uma vez só por aparelho
    setFechado(true);
  };
  return (
    <Folha titulo="Novidades do InstaManager" aoFechar={fechar} centro>
      <h2>Novidades do InstaManager</h2>
      <ul className="novidades" role="list">
        {NOVIDADES.itens.map((t) => <li key={t}>{t}</li>)}
      </ul>
      <button type="button" className="botao" data-foco onClick={fechar}>Bora!</button>
    </Folha>
  );
}
