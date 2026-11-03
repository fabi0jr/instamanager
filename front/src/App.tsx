import { useMe } from './api/useMe';
import { BarraInferior } from './BarraInferior';
import { Entrar } from './conta/Entrar';
import { useRota } from './rotas';

// rotas do grupo de acesso: abertas sem sessão (telas reais na Task 9)
const PUBLICAS = ['/entrar', '/cadastro', '/esqueci-senha', '/nova-senha'];

export function App() {
  const { me, carregando } = useMe();
  const { caminho } = useRota();

  if (carregando) return <div className="carregando" role="status" aria-label="Carregando" />;
  if (!me || PUBLICAS.includes(caminho)) return <Entrar />;
  return (
    <>
      <main>{/* telas das Tasks 9–13 entram aqui */}</main>
      <BarraInferior />
    </>
  );
}
