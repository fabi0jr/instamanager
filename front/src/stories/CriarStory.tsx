import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import type { Me } from '../api/cliente';
import { guardarAviso } from '../aviso';
import { Botao } from '../conta/ui';
import { Icone } from '../feed/icones';
import { comprimir, ErroImagem } from '../postar/comprimir';
import { ComoCbf } from '../postar/ComoCbf';
import { enviarForm } from '../postar/enviar';
import { Link, navegar, useBusca } from '../rotas';
import { codigoDeVideo, duracaoDoArquivo, ERROS_VIDEO, MAX_VIDEO_BYTES, MAX_VIDEO_S, mb, mmss, type CodigoVideo } from './tipos';
import './stories.css';

type Midia = { tipo: 'foto' | 'video'; blob: Blob; url: string; nome: string; duracao?: number };
type Fase = 'escolher' | 'previa' | 'enviando' | 'convertendo';

// /stories/novo: Escolher → Prévia → Enviando (barra de bytes) → Convertendo (só vídeo) → feed
export function CriarStory({ me }: { me: Me }) {
  const [fase, setFase] = useState<Fase>('escolher');
  const [midia, setMidia] = useState<Midia | null>(null);
  const [erro, setErro] = useState<{ titulo: string; texto: string; acao?: 'clubes' | 'video' | 'entendi' } | null>(null);
  const doAdmin = useBusca().get('cbf') === '1' && me.isAdmin; // atalho 'Story da CBF'
  const [cbf, setCbf] = useState(!me.clube || doAdmin);
  const [pct, setPct] = useState({ carregado: 0, total: 0 });
  const cancelar = useRef<(() => void) | null>(null);
  const url = useRef<string | null>(null);
  useEffect(() => () => { if (url.current) URL.revokeObjectURL(url.current); }, []);

  if (!me.clube && !me.isAdmin)
    return (
      <div className="tela criar-story">
        <div className="caixa-info caixa-erro-video" role="alert">
          <h2>Só técnico de clube posta story</h2>
          <p className="giz2">Cada clube tem um técnico, e só ele publica. Veja se tem algum clube livre.</p>
          <Link para="/clubes" className="botao">Ver clubes livres</Link>
        </div>
      </div>
    );

  const mostrarErro = (c: CodigoVideo, s?: number) => setErro({ ...ERROS_VIDEO[c](s), acao: 'video' });

  async function escolher(e: ChangeEvent<HTMLInputElement>, tipo: 'foto' | 'video') {
    const arquivo = e.target.files?.[0];
    e.target.value = '';
    if (!arquivo) return;
    setErro(null);
    if (tipo === 'foto') {
      try {
        const { blob } = await comprimir(arquivo, 1600);
        if (blob.size > 3 * 1024 * 1024) return setErro({ titulo: 'Essa imagem ficou grande demais', texto: 'Escolha outra foto.', acao: 'entendi' });
        if (url.current) URL.revokeObjectURL(url.current);
        url.current = URL.createObjectURL(blob);
        setMidia({ tipo, blob, url: url.current, nome: arquivo.name });
        setFase('previa');
      } catch (er) {
        setErro({ titulo: 'Não deu para ler essa imagem', texto: er instanceof ErroImagem ? 'Escolha outra imagem ou exporte como JPEG.' : 'Tente de novo.', acao: 'entendi' });
      }
      return;
    }
    if (arquivo.size > MAX_VIDEO_BYTES) return mostrarErro('VIDEO_GRANDE'); // antes de enviar um byte
    const d = await duracaoDoArquivo(arquivo);
    if (d !== null && d > MAX_VIDEO_S) return mostrarErro('VIDEO_LONGO', d);
    if (url.current) URL.revokeObjectURL(url.current);
    url.current = URL.createObjectURL(arquivo);
    setMidia({ tipo, blob: arquivo, url: url.current, nome: arquivo.name, duracao: d ?? undefined });
    setFase('previa');
  }

  function publicar() {
    if (!midia) return;
    const f = new FormData();
    if (cbf) f.append('comoCbf', 'true');
    if (midia.tipo === 'foto') f.append('imagem', midia.blob, 'story.jpg');
    else f.append('video', midia.blob, midia.nome);
    setFase('enviando');
    setPct({ carregado: 0, total: 0 });
    const { promessa, cancelar: abortar } = enviarForm('/api/stories', f, (carregado, total) => {
      setPct({ carregado, total });
      if (midia.tipo === 'video' && total > 0 && carregado >= total) setFase('convertendo'); // o envio acabou: agora o servidor converte
    });
    cancelar.current = abortar;
    promessa.then(
      () => { guardarAviso('Story publicado'); navegar('/'); },
      (e) => {
        if (e.codigo === 'CANCELADO') return;
        const v = midia.tipo === 'video' ? codigoDeVideo(e.status, e.codigo) : null;
        if (v) mostrarErro(v);
        else if (e.status === 413) setErro({ titulo: 'Essa imagem passa de 3 MB', texto: 'Escolha outra foto.', acao: 'entendi' }); // imagem: o limite é 3 MB, não 60
        else if (e.codigo === 'IMAGEM_INVALIDA') setErro({ titulo: 'Não deu para ler essa imagem', texto: 'Escolha outra foto ou exporte como JPEG.', acao: 'entendi' });
        else if (e.status === 403) setErro({ titulo: 'Só técnico de clube posta story', texto: 'Seu acesso mudou. Nada foi publicado.', acao: 'clubes' });
        else setErro({ titulo: 'Não deu para publicar', texto: 'Confira a conexão e tente de novo.', acao: 'entendi' });
        setFase('previa');
      },
    );
  }
  const parar = () => { cancelar.current?.(); setFase('previa'); };
  const porcento = pct.total ? Math.round((pct.carregado / pct.total) * 100) : 0;

  return (
    <div className="tela criar-story">
      <button type="button" className="link" aria-label="Sair" onClick={() => navegar('/')}>✕</button>
      <h1>Novo story</h1>
      <p className="giz2">Vai sair como {cbf ? 'CBF' : `${me.clube?.nome}, por ${me.nome}`}. Some em 24 horas.</p>
      {erro && (
        <div className="caixa-info caixa-erro-video" role="alert">
          <h2>{erro.titulo}</h2>
          <p className="giz2">{erro.texto}</p>
          {erro.acao === 'clubes' ? <Link para="/clubes" className="botao">Ver clubes livres</Link> : erro.acao === 'video' ? <button type="button" className="botao" onClick={() => { setErro(null); setMidia(null); setFase('escolher'); }}>Escolher outro vídeo</button> : <button type="button" className="botao" onClick={() => setErro(null)}>Entendi</button>}
        </div>
      )}
      {fase === 'escolher' && !erro && (
        <div className="cartoes-escolha">
          <label>
            <Icone nome="camera" /><strong>Foto</strong><span className="giz2 legenda-s">JPEG de até 3 MB. Reduzida no celular antes de enviar.</span>
            <input type="file" className="sr" accept="image/jpeg,image/png,image/webp" aria-label="Escolher foto" onChange={(e) => escolher(e, 'foto')} />
          </label>
          <label>
            <Icone nome="video" /><strong>Vídeo</strong><span className="giz2 legenda-s">Até 30 s e 60 MB. O app converte para tocar em qualquer celular.</span>
            <input type="file" className="sr" accept="video/*" aria-label="Escolher vídeo" onChange={(e) => escolher(e, 'video')} />
          </label>
        </div>
      )}
      {midia && fase !== 'escolher' && !erro && (
        <>
          {midia.tipo === 'foto' ? <img className="previa-midia" src={midia.url} alt="Prévia do story" /> : <video className="previa-midia" src={midia.url} muted playsInline controls={false} />}
          {midia.duracao !== undefined && <span className="video-dur" style={{ position: 'static', alignSelf: 'flex-start' }}><Icone nome="video" />{mmss(midia.duracao)}</span>}
        </>
      )}
      {fase === 'previa' && midia && !erro && (
        <>
          <ComoCbf me={me} ligado={cbf} aoMudar={setCbf} fixo={!me.clube} />
          <div className="acao-fixa">
            <Botao onClick={publicar}>Publicar story</Botao>
            <Botao variante="secundario" onClick={() => { setMidia(null); setFase('escolher'); }}>Escolher outro</Botao>
          </div>
        </>
      )}
      {fase === 'enviando' && (
        <div className="caixa-info" role="status">
          <h2>Enviando {midia?.tipo === 'video' ? 'vídeo' : 'foto'}…</h2>
          <div className="barra" role="progressbar" aria-label={`Enviando, ${porcento}%`} aria-valuenow={porcento} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${porcento}%` }} /></div>
          <p>{porcento}%{pct.total ? ` · ${mb(pct.carregado)} de ${mb(pct.total)} MB` : ''}</p>
          <p className="giz2 legenda-s">Não feche o app até terminar.</p>
          <button type="button" className="botao secundario" onClick={parar}>Cancelar envio</button>
        </div>
      )}
      {fase === 'convertendo' && (
        <div className="caixa-info" role="status">
          <h2>Convertendo vídeo…</h2>
          <div className="barra-indet" aria-hidden="true"><span /></div>
          <p className="giz2">Já recebemos o vídeo; ele aparece em instantes. O servidor está preparando o vídeo para tocar em qualquer celular (até 1 minuto).</p>
        </div>
      )}
    </div>
  );
}
