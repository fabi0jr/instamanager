import { useState, type ReactNode } from 'react';
import type { Me } from '../api/cliente';
import { guardarAviso } from '../aviso';
import { Aviso, Botao } from '../conta/ui';
import { esquecerFeed } from '../feed/Feed';
import { Link, navegar } from '../rotas';
import { enviarPost } from './enviar';
import { Contador } from './LinhasPrompt';

const LIMITE_TEXTO = 500;

// Post só de texto: um passo, 0 arquivos + `texto` (1–500 sem espaços nas pontas)
export function PostarTexto({ me, seletor }: { me: Me; seletor: ReactNode }) {
  const [texto, setTexto] = useState('');
  const [estado, setEstado] = useState<'livre' | 'enviando' | 'falhou' | 'sem-clube'>('livre');
  const valido = texto.trim().length > 0 && texto.length <= LIMITE_TEXTO;

  function publicar() {
    setEstado('enviando');
    const f = new FormData();
    f.append('texto', texto.trim());
    enviarPost(f, () => {}).promessa.then(
      () => {
        guardarAviso('Post publicado');
        esquecerFeed(); // o feed guardado não tem o post novo
        navegar('/');
      },
      (e) => setEstado(e.codigo === 'SEM_CLUBE' ? 'sem-clube' : 'falhou'),
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
      <p className="giz2">Vai sair como {me.clube!.nome}, por {me.nome}.</p>
      <Aviso>{estado === 'falhou' ? 'Não deu para publicar. Seu texto continua aqui.' : ''}</Aviso>
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
        <Botao disabled={!valido || enviando} onClick={publicar}>
          {enviando ? 'Publicando…' : estado === 'falhou' ? 'Tentar de novo' : 'Publicar'}
        </Botao>
      </div>
    </div>
  );
}
