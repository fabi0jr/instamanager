import { useEffect, useState } from 'react';
import { api, ErroApi } from '../api/cliente';
import { guardarAviso } from '../aviso';
import { esquecerFeed } from '../feed/Feed';
import { Aviso, Botao, useEnvio } from '../conta/ui';
import { Folha } from '../feed/Folha';
import type { Post } from '../feed/tipos';
import { haQuanto } from '../feed/tipos';
import { navegar } from '../rotas';
import { Contador, LIMITE_LEGENDA, LIMITE_PROMPT, LinhasPrompt } from './LinhasPrompt';
import './postar.css';

// /p/:id/editar — só legenda e prompts; as imagens não mudam
export function EditarPost({ id }: { id: string }) {
  const [post, setPost] = useState<Post | 'carregando' | 'erro'>('carregando');
  const [legenda, setLegenda] = useState('');
  const [prompts, setPrompts] = useState<string[]>([]);
  const [semPermissao, setSemPermissao] = useState(false);
  const [descartar, setDescartar] = useState(false);
  const { enviando, aviso, setAviso, enviar } = useEnvio();

  useEffect(() => {
    api<Post>(`/posts/${id}`).then(
      (p) => {
        setPost(p);
        setLegenda(p.legenda);
        setPrompts(p.imagens.map((i) => i.prompt ?? ''));
        if (!p.podeEditar) {
          // torcedor ou ex-técnico: o bloqueio aparece já ao abrir, não só ao salvar
          setSemPermissao(true);
          setAviso('Você não é mais técnico deste clube. Só o técnico atual e o admin editam.');
        }
      },
      () => setPost('erro'),
    );
  }, [id]);

  if (post === 'carregando') return <div className="esqueleto card-esq" aria-busy="true" />;
  if (post === 'erro')
    return (
      <div className="caixa-info" role="alert">
        <h2>Não deu para carregar o post</h2>
        <button type="button" className="botao secundario" onClick={() => navegar('/')}>Voltar ao feed</button>
      </div>
    );

  const mudou = legenda !== post.legenda || prompts.some((p, i) => p !== (post.imagens[i].prompt ?? ''));
  const estouro = legenda.length > LIMITE_LEGENDA || prompts.some((p) => p.length > LIMITE_PROMPT);

  function salvar() {
    enviar(
      async () => {
        await api<Post>(`/posts/${id}`, { method: 'PATCH', body: JSON.stringify({ legenda, prompts: prompts.map((p) => p.trim() || null) }) });
        guardarAviso('Alterações salvas');
        esquecerFeed();
        navegar('/');
      },
      (e: ErroApi) => {
        if (e.codigo !== 'NAO_E_TECNICO') return false;
        setSemPermissao(true);
        setAviso('Você não é mais técnico deste clube. Só o técnico atual e o admin editam.');
        return true;
      },
    );
  }
  const voltar = () => (mudou ? setDescartar(true) : navegar('/'));

  return (
    <div className="tela postar">
      <button type="button" className="link" onClick={voltar}>‹ Voltar</button>
      <h1>Editar post</h1>
      <p>{post.clube.nome} · publicado {haQuanto(post.criadoEm)}</p>
      <div className="miniaturas">{post.imagens.map((i) => <img key={i.id} src={i.miniUrl} alt="" width="56" height="56" />)}</div>
      <p className="giz2">As imagens não mudam. Para trocar, apague o post e publique de novo.</p>
      <Aviso>{aviso && !semPermissao ? `Não deu para salvar. Confira a conexão e tente de novo. O que você escreveu continua aqui.` : aviso}</Aviso>
      <fieldset disabled={semPermissao || enviando} className="campos">
        <label htmlFor="leg">Legenda</label>
        <textarea id="leg" rows={5} value={legenda} aria-invalid={legenda.length > LIMITE_LEGENDA || undefined} onChange={(e) => setLegenda(e.target.value)} />
        <Contador texto={legenda} limite={LIMITE_LEGENDA} />
        <LinhasPrompt linhas={post.imagens} prompts={prompts} aoMudar={(i, v) => setPrompts(prompts.map((p, j) => (j === i ? v : p)))} />
      </fieldset>
      <div className="acao-fixa">
        <Botao carregando={enviando ? 'Salvando…' : undefined} disabled={!mudou || estouro || semPermissao} onClick={salvar}>Salvar alterações</Botao>
      </div>
      {descartar && (
        <Folha titulo="Descartar as alterações?" aoFechar={() => setDescartar(false)}>
          <h2>Descartar as alterações?</h2>
          <button type="button" className="botao" onClick={() => setDescartar(false)}>Continuar editando</button>
          <button type="button" className="botao fantasma" onClick={() => navegar('/')}>Descartar</button>
        </Folha>
      )}
    </div>
  );
}
