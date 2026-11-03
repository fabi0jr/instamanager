import { useEffect } from 'react';
import { useMe } from './api/useMe';
import { BarraInferior } from './BarraInferior';
import { Cadastro } from './conta/Cadastro';
import { Entrar } from './conta/Entrar';
import { Esqueci } from './conta/Esqueci';
import { NovaSenha } from './conta/NovaSenha';
import { Perfil } from './conta/Perfil';
import { navegar, useRota } from './rotas';

// rotas do grupo de acesso: abertas sem sessão
const PUBLICAS = ['/entrar', '/cadastro', '/esqueci-senha', '/nova-senha'];

export function App() {
  const { me, carregando, recarregar } = useMe();
  const { caminho } = useRota();
  const publica = PUBLICAS.includes(caminho);

  // logada numa tela de acesso (acabou de entrar): vai para o feed
  useEffect(() => {
    if (me && publica && caminho !== '/nova-senha') navegar('/');
  }, [me, publica, caminho]);

  if (carregando) return <div className="carregando" role="status" aria-label="Carregando" />;
  if (!me) {
    if (caminho === '/cadastro') return <Cadastro aoEntrar={recarregar} />;
    if (caminho === '/esqueci-senha') return <Esqueci />;
    if (caminho === '/nova-senha') return <NovaSenha />;
    return <Entrar aoEntrar={recarregar} />;
  }
  return (
    <>
      <main>{caminho === '/perfil' && <Perfil me={me} recarregar={recarregar} />}</main>
      <BarraInferior clubeId={me.clube?.id} />
    </>
  );
}
