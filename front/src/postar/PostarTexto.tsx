import { useState, type ReactNode } from 'react';
import type { Me } from '../api/cliente';
import { guardarAviso } from '../aviso';
import { Aviso, Botao } from '../conta/ui';
import { esquecerFeed } from '../feed/Feed';
import { Link, navegar } from '../rotas';
import { registrarErro } from '../erros';
import { ComoCbf, MSG_SEM_ADMIN, quemPosta } from './ComoCbf';
import { enviarPost } from './enviar';
import { Contador } from './LinhasPrompt';

const LIMITE_TEXTO = 500;

// Post só de texto: um passo, 0 arquivos + `texto` (1–500 sem espaços nas pontas)
export function PostarTexto({ me, seletor }: { me: Me; seletor: ReactNode }) {
  const [texto, setTexto] = useState('');
  const [estado, setEstado] = useState<'livre' | 'enviando' | 'falhou' | 'sem-clube' | 'sem-admin'>('livre');
  const [cbf, setCbf] = useState(false);
  const valido = texto.trim().length > 0 && texto.length <= LIMITE_TEXTO;

  function publicar(comoCbf = cbf) {
    setEstado('enviando');
    const f = new FormData();
    if (comoCbf) f.append('comoCbf', 'true');
    f.append('texto', texto.trim());
    enviarPost(f, () => {}).promessa.then(
      () => {
        guardarAviso('Post publicado');
        esquecerFeed(); // o feed guardado não tem o post novo
        navegar('/');
      },
      (e) => {
        registrarErro(`falha ao publicar post: ${e.codigo ?? e.message}`);
        setEstado(e.codigo === 'SEM_CLUBE' ? 'sem-clube' : e.codigo === 'NAO_E_ADMIN' ? 'sem-admin' : 'falhou');
      },
    );
  }

  if (estado === 'sem-clube')
    return (
      <div className="tela postar">
        <h1>Você não pode publicar agora</h1>
        <p>Você deixou de ser técnico de um clube, então não dá para publicar. Nada foi enviado.</p>
        <Link para="/clubes" className="botao">Ver clubes livres</Link>
        <Link para="/" className="botao fantasma">Voltar ao feed</Link>
      </div>
    );

  const enviando = estado === 'enviando';
  return (
    <div className="tela postar cartao largo">
      <button type="button" className="link" aria-label="Sair" onClick={() => navegar('/')}>✕</button>
      {seletor}
      <p className={cbf ? 'cbf-frase' : 'giz2'}>{quemPosta(me, cbf)}</p>
      <ComoCbf me={me} ligado={cbf} aoMudar={setCbf} />
      <Aviso>{estado === 'falhou' ? 'Não deu para publicar. Seu texto continua aqui.' : estado === 'sem-admin' ? MSG_SEM_ADMIN : ''}</Aviso>
      <textarea
        rows={8}
        className="campo-texto"
        placeholder="O que está rolando?"
        aria-label="Texto do post"
        value={texto}
        disabled={enviando}
        aria-invalid={texto.length > LIMITE_TEXTO || undefined}
        onChange={(e) => setTexto(e.target.value)}
      />
      <Contador texto={texto} limite={LIMITE_TEXTO} />
      <p className="giz2">Dá para usar #tags.</p>
      <div className="acao-fixa">
        <Botao disabled={!valido || enviando} onClick={() => (estado === 'sem-admin' ? (setCbf(false), publicar(false)) : publicar())}>
          {enviando ? 'Publicando…' : estado === 'sem-admin' ? 'Publicar pelo meu clube' : estado === 'falhou' ? 'Tentar de novo' : cbf ? 'Publicar como CBF' : 'Publicar'}
        </Botao>
      </div>
    </div>
  );
}
