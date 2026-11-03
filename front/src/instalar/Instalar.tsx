import { useEffect, useState, type ReactNode } from 'react';
import { Aviso, Botao } from '../conta/ui';
import { navegar } from '../rotas';
import { marcarVisto } from './fluxo';
import './instalar.css';
import { aoChegarPrompt, ehAndroid, ehIOS, instalado, limparPrompt, promptAdiado } from './plataforma';
import { ativarPush, suportaPush } from './push';

// Segue docs/design/instalar-troca-admin.md ("Instalar o app" e "Permissão de notificação").
// Tudo opcional: "Agora não" guarda a escolha e vai ao feed. A permissão só é pedida no toque em "Ativar avisos".

const Icone = ({ d }: { d: ReactNode }) => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>
);
const IcCompartilhar = () => <Icone d={<><path d="M12 15V4M8 8l4-4 4 4" /><path d="M6 11H5a1 1 0 00-1 1v7a1 1 0 001 1h14a1 1 0 001-1v-7a1 1 0 00-1-1h-1" /></>} />;
const IcAdicionar = () => <Icone d={<><rect x="4" y="4" width="16" height="16" rx="3" /><path d="M12 8v8M8 12h8" /></>} />;
const IcSino = () => <Icone d={<path d="M6 9a6 6 0 0112 0c0 6 2 7 2 7H4s2-1 2-7zM10 20a2 2 0 004 0" />} />;
const IcOk = () => <svg className="ok-grande" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10" /><path d="M8 12.5l3 3 5-6" /></svg>;
const IcAlerta = () => <svg className="alerta-ambar" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3l10 18H2z" /><path d="M12 10v5M12 18v.5" /></svg>;

const irAoFeed = () => navegar('/');
function agoraNao() {
  marcarVisto();
  irAoFeed();
}

function ComoInstalarIOS() {
  const [instalei, setInstalei] = useState(false);
  return (
    <div className="tela instalar">
      <img src="/icones/icon-192.png" alt="" width="64" height="64" />
      <h1>Instale o InstaManager</h1>
      <p>Fica na tela inicial como um app, abre mais rápido e permite receber avisos.</p>
      <p className="giz2"><strong>Faça isso no Safari</strong></p>
      <ol className="passos-instalar">
        <li><span className="n">1</span><span><strong>Toque em Compartilhar</strong><small>o quadrado com a seta, na barra de baixo</small></span><IcCompartilhar /></li>
        <li><span className="n">2</span><span><strong>Role e toque em “Adicionar à Tela de Início”</strong><span className="ex-ios"><IcAdicionar /> Adicionar à Tela de Início</span></span></li>
        <li><span className="n">3</span><span><strong>Toque em “Adicionar”</strong><small>Depois, abra o InstaManager pela tela inicial.</small></span></li>
      </ol>
      {instalei && <p role="status">Abra o app pela tela inicial para continuar.</p>}
      <div className="acao-fixa duas">
        <Botao onClick={() => setInstalei(true)}>Já instalei</Botao>
        <Botao variante="fantasma" onClick={agoraNao}>Agora não</Botao>
      </div>
    </div>
  );
}

function ComoInstalarAndroid() {
  const [, atualizar] = useState(0);
  useEffect(() => aoChegarPrompt(() => atualizar((n) => n + 1)), []);
  const evento = promptAdiado();
  async function instalar() {
    if (!evento) return;
    await evento.prompt();
    const { outcome } = await evento.userChoice;
    limparPrompt();
    if (outcome === 'accepted') navegar('/avisos');
    else atualizar((n) => n + 1);
  }
  return (
    <div className="tela instalar">
      <img src="/icones/icon-192.png" alt="" width="64" height="64" />
      <h1>Instale o InstaManager</h1>
      <p>Fica na tela inicial como um app, abre mais rápido e permite receber avisos.</p>
      {evento && <Botao onClick={instalar}>Instalar app</Botao>}
      <p className="giz2">{evento ? 'Se o botão não aparecer:' : 'Para instalar:'}</p>
      <ol className="passos-instalar">
        <li><span className="n">1</span><span><strong>Toque nos três pontos ⋮ do Chrome</strong></span></li>
        <li><span className="n">2</span><span><strong>Toque em “Instalar app”</strong><small>(ou “Adicionar à tela inicial”)</small></span></li>
      </ol>
      <div className="acao-fixa"><Botao variante="fantasma" onClick={agoraNao}>Agora não</Botao></div>
    </div>
  );
}

function InstalarOutro() {
  return (
    <div className="tela instalar">
      <h1>Dá para usar pelo navegador mesmo.</h1>
      <p>Para instalar, abra o endereço no Safari (iPhone) ou no Chrome (Android).</p>
      <div className="acao-fixa"><Botao onClick={() => navegar('/avisos')}>Continuar</Botao></div>
    </div>
  );
}

type Fase = 'pedir' | 'ativados' | 'negados' | 'sem-suporte';
const permissaoAtual = () => (typeof Notification !== 'undefined' ? Notification.permission : 'default');

function Avisos({ recarregar }: { recarregar: () => void }) {
  const ios = ehIOS();
  const [fase, setFase] = useState<Fase>(() => (!suportaPush() ? 'sem-suporte' : permissaoAtual() === 'denied' ? 'negados' : 'pedir'));
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState('');

  if (ios && !instalado())
    return (
      <div className="tela instalar">
        <IcAlerta />
        <h1>No iPhone, os avisos só funcionam com o app instalado.</h1>
        <div className="acao-fixa duas">
          <Botao onClick={() => navegar('/instalar')}>Ver como instalar</Botao>
          <Botao variante="fantasma" onClick={agoraNao}>Agora não</Botao>
        </div>
      </div>
    );

  async function ativar() {
    setEnviando(true);
    setAviso('');
    try {
      const r = await ativarPush();
      if (r === 'ok') {
        marcarVisto();
        recarregar();
      }
      setFase(r === 'ok' ? 'ativados' : r === 'negado' ? 'negados' : 'sem-suporte');
    } catch {
      setAviso('Não deu para ativar. Tente de novo.');
    } finally {
      setEnviando(false);
    }
  }

  if (fase === 'sem-suporte')
    return (
      <div className="tela instalar">
        <IcAlerta />
        <h1>Sem avisos neste aparelho</h1>
        <p>Este aparelho não recebe avisos do navegador. Você usa o app normalmente.</p>
        <div className="acao-fixa"><Botao onClick={agoraNao}>Continuar</Botao></div>
      </div>
    );
  if (fase === 'ativados')
    return (
      <div className="tela instalar">
        <IcOk />
        <h1>Avisos ativados</h1>
        <p>Você recebe um aviso quando alguém posta e quando comentam no seu clube. Para desligar, vá em Perfil → Notificações.</p>
        <div className="acao-fixa"><Botao onClick={irAoFeed}>Ir para o feed</Botao></div>
      </div>
    );
  if (fase === 'negados')
    return (
      <div className="tela instalar">
        <IcAlerta />
        <h1>Avisos bloqueados</h1>
        <p>O aparelho está bloqueando as notificações do InstaManager. Para liberar:</p>
        <div className="caixa-info"><strong>iPhone</strong><p>Ajustes → Notificações → InstaManager → Permitir notificações</p></div>
        <div className="caixa-info"><strong>Android</strong><p>Toque no cadeado ou ⋮ → Configurações do site → Notificações → Permitir</p></div>
        <div className="acao-fixa duas">
          <Botao onClick={() => setFase(permissaoAtual() === 'denied' ? 'negados' : 'pedir')}>Já liberei, tentar de novo</Botao>
          <Botao variante="fantasma" onClick={agoraNao}>Agora não</Botao>
        </div>
      </div>
    );
  return (
    <div className="tela instalar">
      <IcSino />
      <h1>Quer saber quando sai post?</h1>
      <ul className="itens-soltos"><li>Post novo de qualquer clube</li><li>Comentário nos posts do seu clube</li></ul>
      <p className="giz2">Você pode desligar quando quiser, no Perfil.</p>
      <Aviso>{aviso}</Aviso>
      <div className="acao-fixa duas">
        <Botao onClick={ativar} carregando={enviando ? 'Ativando…' : undefined}>Ativar avisos</Botao>
        <Botao variante="fantasma" onClick={agoraNao} disabled={enviando}>Agora não</Botao>
      </div>
    </div>
  );
}

/** /instalar e /avisos. `recarregar` atualiza o `me` (pushEnabled) depois de ativar. */
export function Instalar({ caminho, recarregar }: { caminho: string; recarregar: () => void }) {
  const jaInstalado = instalado();
  // app já na tela inicial: instalar não faz sentido, vai direto aos avisos
  useEffect(() => {
    if (caminho === '/instalar' && jaInstalado) navegar('/avisos');
  }, [caminho, jaInstalado]);
  if (caminho === '/avisos') return <Avisos recarregar={recarregar} />;
  if (jaInstalado) return null;
  if (ehIOS()) return <ComoInstalarIOS />;
  if (ehAndroid()) return <ComoInstalarAndroid />;
  return <InstalarOutro />;
}
