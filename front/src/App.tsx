import { useEffect } from 'react';
import { useMe } from './api/useMe';
import { BarraInferior } from './BarraInferior';
import { Admin } from './admin/Admin';
import { Atividade } from './atividade/Atividade';
import { Busca } from './busca/Busca';
import { FaixaStories } from './stories/Faixa';
import { CriarStory } from './stories/CriarStory';
import { Visualizador } from './stories/Visualizador';
import { Cadastro } from './conta/Cadastro';
import { Entrar } from './conta/Entrar';
import { Esqueci } from './conta/Esqueci';
import { NovaSenha } from './conta/NovaSenha';
import { Perfil } from './conta/Perfil';
import { TrocarSenha } from './conta/TrocarSenha';
import { ListaClubes } from './clube/ListaClubes';
import { EditarClube } from './clube/EditarClube';
import { PerfilClube } from './clube/PerfilClube';
import { AvisoVotacao, Votar } from './votacoes/Votacoes';
import { Liga } from './liga/Liga';
import { PerfilPessoa } from './pessoa/PerfilPessoa';
import { Galeria } from './galeria/Galeria';
import { Feed } from './feed/Feed';
import { proximaTela } from './instalar/fluxo';
import { Instalar } from './instalar/Instalar';
import { lerVolta } from './instalar/volta';
import { PostPagina } from './feed/PostPagina';
import { EditarPost } from './postar/EditarPost';
import { Postar } from './postar/Postar';
import { emEdicao, navegar, PUBLICAS, rotaConhecida, useRota, voltar } from './rotas';
import { Novidades } from './Novidades';
import { Tag } from './tag/Tag';
import { Trocar } from './trocas/Trocar';

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

  // postar e editar são fluxos de tela cheia no celular: a barra não cobre o botão fixo (no desktop a lateral fica)
  const telaCheia = emEdicao(caminho);
  const comBarra = !carregando && !!me && caminho !== '/nova-senha';

  const tela = (() => {
    if (carregando) return <div className="carregando" role="status" aria-label="Carregando" />;
    // o link do e-mail abre a tela com ou sem sessão
    if (caminho === '/nova-senha') return <NovaSenha />;
    if (!me) {
      if (caminho === '/cadastro') return <Cadastro aoEntrar={recarregar} />;
      if (caminho === '/esqueci-senha') return <Esqueci />;
      return <Entrar aoEntrar={recarregar} />;
    }
    return (
      <main className={telaCheia ? 'tela-cheia' : ''}>
        {!rotaConhecida(caminho) && (
          <div className="caixa-info nao-achada" role="alert" style={{ margin: 16 }}>
            <h2>Não achamos essa página</h2>
            <p className="giz2">O endereço não existe ou mudou.</p>
            <button type="button" className="botao" onClick={() => voltar('/')}>Voltar</button>
          </div>
        )}
        {caminho === '/' && <><AvisoVotacao /><Feed me={me} abaixoDoTopo={<FaixaStories me={me} />} /></>}
        {params.id && /^\/p\/[^/]+$/.test(caminho) && <div className="post-pagina"><PostPagina id={params.id} me={me} /></div>}
        {params.id && /^\/p\/[^/]+\/editar$/.test(caminho) && <div className="post-pagina"><EditarPost id={params.id} /></div>}
        {params.id && /^\/c\/[^/]+$/.test(caminho) && <PerfilClube id={params.id} me={me} />}
        {params.id && /^\/c\/[^/]+\/editar$/.test(caminho) && <EditarClube id={params.id} me={me} />}
        {params.id && /^\/u\/[^/]+$/.test(caminho) && <PerfilPessoa id={params.id} />}
        {params.tag && /^\/tag\/[^/]+$/.test(caminho) && <Tag tag={params.tag} />}
        {caminho === '/clubes' && <ListaClubes />}
        {params.id && /^\/votacoes\/[^/]+$/.test(caminho) && <Votar id={params.id} />}
        {caminho === '/liga' && <Liga me={me} />}
        {caminho === '/atividade' && <Atividade />}
        {caminho === '/stories/novo' && <CriarStory me={me} />}
        {params.clubeId && /^\/stories\/[^/]+$/.test(caminho) && caminho !== '/stories/novo' && <Visualizador clubeId={params.clubeId} me={me} />}
        {caminho === '/busca' && <Busca />}
        {caminho === '/galeria' && <Galeria />}
        {caminho === '/postar' && <Postar me={me} />}
        {caminho === '/perfil/senha' && <TrocarSenha pushEnabled={me.pushEnabled} />}
        {caminho === '/perfil' && <Perfil me={me} recarregar={recarregar} />}
        {caminho === '/trocar' && <Trocar me={me} />}
        {(caminho === '/admin' || caminho.startsWith('/admin/')) && <Admin me={me} caminho={caminho} />}
        {(caminho === '/instalar' || caminho === '/avisos') && <Instalar caminho={caminho} recarregar={recarregar} />}
      </main>
    );
  })();

  return (
    <>
      <div id="rolagem">{tela}</div>
      {comBarra && <Novidades caminho={caminho} />}
      {comBarra && me && <BarraInferior clubeId={me.clube?.id} soDesktop={telaCheia} />}
    </>
  );
}
