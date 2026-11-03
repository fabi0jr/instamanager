import { useEffect } from 'react';
import { useMe } from './api/useMe';
import { BarraInferior } from './BarraInferior';
import { Cadastro } from './conta/Cadastro';
import { Entrar } from './conta/Entrar';
import { Esqueci } from './conta/Esqueci';
import { NovaSenha } from './conta/NovaSenha';
import { Perfil } from './conta/Perfil';
import { Feed } from './feed/Feed';
import { PostPagina } from './feed/PostPagina';
import { navegar, PUBLICAS, useRota } from './rotas';

export function App() {
  const { me, carregando, recarregar } = useMe();
  const { caminho, params } = useRota();
  const publica = PUBLICAS.includes(caminho);

  // logada numa tela de acesso (acabou de entrar): vai para o feed
  useEffect(() => {
    if (me && publica && caminho !== '/nova-senha') navegar('/');
  }, [me, publica, caminho]);

  if (carregando) return <div className="carregando" role="status" aria-label="Carregando" />;
  // o link do e-mail abre a tela com ou sem sessão
  if (caminho === '/nova-senha') return <NovaSenha />;
  if (!me) {
    if (caminho === '/cadastro') return <Cadastro aoEntrar={recarregar} />;
    if (caminho === '/esqueci-senha') return <Esqueci />;
    return <Entrar aoEntrar={recarregar} />;
  }
  return (
    <>
      <main>
        {caminho === '/' && <Feed me={me} />}
        {caminho.startsWith('/p/') && params.id && <div className="post-pagina"><PostPagina id={params.id} me={me} /></div>}
        {caminho === '/perfil' && <Perfil me={me} recarregar={recarregar} />}
      </main>
      <BarraInferior clubeId={me.clube?.id} />
    </>
  );
}
