import { useEffect } from 'react';
import { useMe } from './api/useMe';
import { BarraInferior } from './BarraInferior';
import { Cadastro } from './conta/Cadastro';
import { Entrar } from './conta/Entrar';
import { Esqueci } from './conta/Esqueci';
import { NovaSenha } from './conta/NovaSenha';
import { Perfil } from './conta/Perfil';
import { Feed } from './feed/Feed';
import { proximaTela } from './instalar/fluxo';
import { Instalar } from './instalar/Instalar';
import { lerVolta } from './instalar/volta';
import { PostPagina } from './feed/PostPagina';
import { EditarPost } from './postar/EditarPost';
import { Postar } from './postar/Postar';
import { navegar, PUBLICAS, useRota } from './rotas';

export function App() {
  const { me, carregando, recarregar } = useMe();
  const { caminho, params } = useRota();
  const publica = PUBLICAS.includes(caminho);

  // logada: 1) volta à rota de entrada guardada (link de push aberto deslogado); 2) sai da tela de acesso para o feed;
  // 3) primeira vez neste aparelho, o feed abre antes em /instalar ou /avisos (uma vez; "Agora não" guarda)
  useEffect(() => {
    if (!me) return;
    const volta = lerVolta();
    if (volta) {
      if (volta !== location.pathname + location.search) navegar(volta);
      return;
    }
    if (publica && caminho !== '/nova-senha') return navegar('/');
    if (caminho === '/') {
      const tela = proximaTela();
      if (tela) navegar(tela);
    }
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
        {params.id && /^\/p\/[^/]+$/.test(caminho) && <div className="post-pagina"><PostPagina id={params.id} me={me} /></div>}
        {params.id && caminho.endsWith('/editar') && <div className="post-pagina"><EditarPost id={params.id} /></div>}
        {caminho === '/postar' && <Postar me={me} />}
        {caminho === '/perfil' && <Perfil me={me} recarregar={recarregar} />}
        {(caminho === '/instalar' || caminho === '/avisos') && <Instalar caminho={caminho} recarregar={recarregar} />}
      </main>
      <BarraInferior clubeId={me.clube?.id} />
    </>
  );
}
