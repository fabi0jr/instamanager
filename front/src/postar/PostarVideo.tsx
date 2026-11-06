import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import type { Me } from '../api/cliente';
import { guardarAviso } from '../aviso';
import { registrarErro } from '../erros';
import { Botao } from '../conta/ui';
import { esquecerFeed } from '../feed/Feed';
import { Autocompletar } from '../mencoes/Autocompletar';
import { useMencoes } from '../mencoes/mencoes';
import { codigoDeVideo, duracaoDoArquivo, ERROS_VIDEO, MAX_VIDEO_BYTES, MAX_VIDEO_S, mb, mmss, type CodigoVideo } from '../stories/tipos';
import { navegar } from '../rotas';
import { ComoCbf, quemPosta } from './ComoCbf';
import { enviarPost } from './enviar';
import { Contador, LIMITE_LEGENDA } from './LinhasPrompt';
import { AreaSoltar, type Entrega } from './AreaSoltar';

// Aba Vídeo: 1 vídeo por post (sem prompt, fora da galeria). Passo 1 escolhe, passo 2 legenda, passo 3 envia e converte.
export function PostarVideo({ me, seletor, aoConteudo, entrega, aoReceber, aoSoltar }: { me: Me; seletor: ReactNode; aoConteudo?: (tem: boolean) => void; entrega?: Entrega | null; aoReceber?: () => void; aoSoltar?: (arquivos: File[]) => string | void }) {
  const [passo, setPasso] = useState(1);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [duracao, setDuracao] = useState<number | null>(null);
  const [url, setUrl] = useState('');
  const [legenda, setLegenda] = useState('');
  const [cbf, setCbf] = useState(!me.clube);
  const [erro, setErro] = useState<{ titulo: string; texto: string } | null>(null);
  const [fase, setFase] = useState<'enviando' | 'convertendo'>('enviando');
  const [pct, setPct] = useState({ carregado: 0, total: 0 });
  const cancelar = useRef<(() => void) | null>(null);
  const campo = useRef<HTMLTextAreaElement>(null);
  const mencoes = useMencoes();
  const comConteudo = !!arquivo || legenda.length > 0;
  useEffect(() => aoConteudo?.(comConteudo), [comConteudo]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);

  async function escolher(e: ChangeEvent<HTMLInputElement>) {
    const a = e.target.files?.[0];
    e.target.value = '';
    if (a) await receber(a);
  }

  useEffect(() => { // vídeo solto (aqui ou na aba Foto)
    if (entrega?.modo !== 'video') return;
    aoReceber?.();
    void receber(entrega.arquivos[0]);
  }, [entrega]); // eslint-disable-line react-hooks/exhaustive-deps

  async function receber(a: File) {
    setErro(null);
    if (a.size > MAX_VIDEO_BYTES) return setErro(ERROS_VIDEO.VIDEO_GRANDE());
    const d = await duracaoDoArquivo(a);
    if (d !== null && d > MAX_VIDEO_S) return setErro(ERROS_VIDEO.VIDEO_LONGO(d));
    setArquivo(a);
    setDuracao(d);
    setUrl(URL.createObjectURL(a));
  }

  function publicar() {
    if (!arquivo) return;
    const f = new FormData();
    if (cbf) f.append('comoCbf', 'true');
    f.append('legenda', mencoes.serializar(legenda));
    f.append('video', arquivo, arquivo.name);
    setPasso(3);
    setFase('enviando');
    setPct({ carregado: 0, total: 0 });
    const { promessa, cancelar: abortar } = enviarPost(f, (carregado, total) => {
      setPct({ carregado, total });
      if (total > 0 && carregado >= total) setFase('convertendo');
    });
    cancelar.current = abortar;
    promessa.then(
      () => { guardarAviso('Post publicado'); esquecerFeed(); navegar('/'); },
      (e) => {
        if (e.codigo === 'CANCELADO') return;
        registrarErro(`falha ao publicar vídeo: ${e.codigo ?? e.message}`);
        const v: CodigoVideo | null = codigoDeVideo(e.status, e.codigo);
        setErro(v ? ERROS_VIDEO[v]() : e.codigo === 'SEM_CLUBE' ? { titulo: 'Você não pode publicar agora', texto: 'Você deixou de ser técnico de um clube, então não dá para publicar. Nada foi enviado.' } : e.codigo === 'NAO_E_ADMIN' ? { titulo: 'Só o admin pode postar como CBF', texto: 'Seu acesso mudou. Publique pelo seu clube.' } : { titulo: 'Não deu para publicar', texto: 'Confira a conexão e tente de novo. O vídeo continua escolhido.' });
        setPasso(v ? 1 : 2);
        if (v) { setArquivo(null); setUrl(''); }
      },
    );
  }
  const porcento = pct.total ? Math.round((pct.carregado / pct.total) * 100) : 0;
  const bloco = erro && (
    <div className="caixa-info caixa-erro-video" role="alert"><h2>{erro.titulo}</h2><p className="giz2">{erro.texto}</p></div>
  );

  if (passo === 3)
    return (
      <div className="tela postar">
        <h1>{fase === 'convertendo' ? 'Convertendo vídeo…' : 'Publicando…'}</h1>
        {fase === 'enviando' ? (
          <>
            <div className="barra" role="progressbar" aria-label={`Publicando, ${porcento}%`} aria-valuenow={porcento} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${porcento}%` }} /></div>
            <div className="progresso-txt"><span className="numero">{porcento}%</span><span className="giz2">{pct.total ? `${mb(pct.carregado)} de ${mb(pct.total)} MB` : ''}</span></div>
            <p className="giz2">Não feche o app até terminar.</p>
          </>
        ) : (
          <>
            <div className="barra-indet" aria-hidden="true"><span /></div>
            <p className="giz2">Já recebemos o vídeo; ele aparece em instantes. O servidor está preparando o vídeo (até 1 minuto).</p>
          </>
        )}
        {fase === 'enviando' && <button type="button" className="botao fantasma" onClick={() => { cancelar.current?.(); setPasso(2); }}>Cancelar envio</button>}
      </div>
    );

  return (
    <div className="tela postar cartao largo">
      {passo === 1 ? <button type="button" className="link" aria-label="Sair" onClick={() => navegar('/')}>✕</button> : <button type="button" className="link" onClick={() => setPasso(1)}>‹ Voltar</button>}
      {seletor}
      {bloco}
      {passo === 1 && (
        <>
          <h1>Escolha o vídeo</h1>
          {arquivo ? (
            <>
              <video className="previa-midia" src={url} muted playsInline aria-label="Prévia do vídeo" />
              <p>{arquivo.name}</p>
              <p className="giz2">{duracao !== null ? `${mmss(duracao)} · ` : ''}{mb(arquivo.size)} MB · converte ao publicar</p>
              <label htmlFor="video-postar" className="botao secundario">Trocar vídeo</label>
            </>
          ) : (
            <>
              <p className="giz2">MP4 ou MOV, até 30 s e 60 MB. O iPhone grava em MOV: tudo bem, o app converte.</p>
              {aoSoltar ? <AreaSoltar para="video-postar" rotulo="Escolher vídeo" aoSoltar={aoSoltar} /> : <label htmlFor="video-postar" className="botao secundario">Escolher vídeo</label>}
            </>
          )}
          <input id="video-postar" type="file" accept="video/*" className="sr" aria-label="Escolher vídeo" onChange={escolher} />
          <div className="acao-fixa"><Botao disabled={!arquivo} onClick={() => setPasso(2)}>Continuar</Botao></div>
        </>
      )}
      {passo === 2 && (
        <>
          <h1>Legenda</h1>
          <p className={cbf ? 'cbf-frase' : 'giz2'}>{quemPosta(me, cbf)}</p>
          <ComoCbf me={me} ligado={cbf} aoMudar={setCbf} fixo={!me.clube} />
          <p className="giz2">Vídeo não tem prompt e não aparece na galeria.</p>
          <label htmlFor="legenda-video">Legenda</label>
          <div className="mencao-ancora">
            <Autocompletar valor={legenda} aoMudar={setLegenda} campo={campo} mencoes={mencoes} />
            <textarea ref={campo} id="legenda-video" rows={5} value={legenda} aria-invalid={legenda.length > LIMITE_LEGENDA || undefined} onKeyDown={(e) => mencoes.teclado(e, legenda, setLegenda)} onChange={(e) => setLegenda(e.target.value)} />
          </div>
          <Contador texto={legenda} limite={LIMITE_LEGENDA} />
          <div className="acao-fixa"><Botao disabled={mencoes.serializar(legenda).length > LIMITE_LEGENDA} onClick={publicar}>{cbf ? 'Publicar como CBF' : 'Publicar'}</Botao></div>
        </>
      )}
    </div>
  );
}
