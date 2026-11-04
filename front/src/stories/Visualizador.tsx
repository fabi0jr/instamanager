import { useEffect, useRef, useState, type PointerEvent, type MouseEvent } from 'react';
import { api, type Me } from '../api/cliente';
import { Dialogo } from '../admin/Dialogo';
import { Escudo } from '../feed/Escudo';
import { Folha } from '../feed/Folha';
import { IcFechar, IcLixo, IcOlho, IcVolume } from '../feed/icones';
import { haQuanto } from '../feed/tipos';
import { voltar } from '../rotas';
import { ordenar } from './Faixa';
import type { FaixaClube } from './tipos';
import './stories.css';

const IMAGEM_MS = 5000;
let somLigado = false; // a escolha de som vale para os próximos stories da sessão
let dicaMostrada = false;

// /stories/:clubeId — tela cheia, segue para o próximo clube da faixa. Tocar avança/volta, segurar pausa, arrastar para baixo ou Esc fecha.
export function Visualizador({ clubeId, me }: { clubeId: string; me: Me }) {
  const [lista, setLista] = useState<FaixaClube[] | 'carregando' | 'erro'>('carregando');
  const [ci, setCi] = useState(-1);
  const [si, setSi] = useState(0);
  const [prog, setProg] = useState(0);
  const [segurando, setSegurando] = useState(false);
  const [mudo, setMudo] = useState(!somLigado);
  const [dica, setDica] = useState(false);
  const [falhou, setFalhou] = useState(false);
  const [vistos, setVistos] = useState<{ id: string; nome: string }[] | null>(null);
  const [folha, setFolha] = useState(false);
  const [apagar, setApagar] = useState(false);
  const [arrasto, setArrasto] = useState(0);
  const video = useRef<HTMLVideoElement>(null);
  const toque = useRef<{ x: number; y: number; t: ReturnType<typeof setTimeout> | undefined; segurou: boolean } | null>(null);

  function carregar() {
    setLista('carregando');
    api<FaixaClube[]>('/stories').then(
      (l) => {
        const ord = ordenar(Array.isArray(l) ? l : [], me.clube?.id);
        setLista(ord);
        const i = ord.findIndex((f) => f.clube.id === clubeId);
        setCi(i);
        setSi(Math.max(0, ord[i]?.stories.findIndex((s) => !s.visto) ?? 0));
      },
      () => setLista('erro'),
    );
  }
  useEffect(carregar, [clubeId]); // eslint-disable-line react-hooks/exhaustive-deps

  const faixa = Array.isArray(lista) ? lista[ci] : undefined;
  const story = faixa?.stories[si];
  const souAutor = !!faixa && (me.clube?.id === faixa.clube.id || (me.isAdmin && faixa.clube.id === 'cbf'));
  const pausado = segurando || folha || apagar;

  function fechar() {
    voltar('/');
  }
  function proximo() {
    if (!Array.isArray(lista) || !faixa) return;
    setProg(0);
    setFalhou(false);
    if (si < faixa.stories.length - 1) return setSi(si + 1);
    if (ci < lista.length - 1) {
      setCi(ci + 1);
      return setSi(0);
    }
    fechar();
  }
  function anterior() {
    setProg(0);
    if (si > 0) return setSi(si - 1);
    if (Array.isArray(lista) && ci > 0) {
      setCi(ci - 1);
      setSi(Math.max(0, lista[ci - 1].stories.length - 1));
    }
  }

  // marca como visto ao abrir cada story; o autor carrega quem viu
  useEffect(() => {
    if (!story) return;
    setProg(0);
    setFalhou(false);
    api(`/stories/${story.id}/visto`, { method: 'PUT' }).catch(() => {});
    setVistos(null);
    if (souAutor) api<{ id: string; nome: string }[]>(`/stories/${story.id}/vistos`).then((l) => setVistos(Array.isArray(l) ? l : []), () => setVistos([]));
  }, [story?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // imagem: 5 s no relógio; vídeo: quem manda é o próprio vídeo (timeupdate/ended)
  useEffect(() => {
    if (!story || story.tipo !== 'IMAGEM' || pausado || falhou) return;
    const t = setInterval(() => setProg((p) => p + 50 / IMAGEM_MS), 50);
    return () => clearInterval(t);
  }, [story?.id, pausado, falhou]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (story?.tipo === 'IMAGEM' && prog >= 1) proximo();
  }, [prog]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const v = video.current;
    if (!v) return;
    v.muted = mudo;
    if (pausado) v.pause();
    else v.play?.()?.catch?.(() => {});
  }, [pausado, mudo, story?.id]);
  useEffect(() => {
    if (story?.tipo !== 'VIDEO' || dicaMostrada || !mudo) return;
    dicaMostrada = true;
    setDica(true);
    const t = setTimeout(() => setDica(false), 4000);
    return () => clearTimeout(t);
  }, [story?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && !folha && !apagar && fechar();
    document.addEventListener('keydown', tecla);
    return () => document.removeEventListener('keydown', tecla);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  // Folha e Dialogo vão por portal, mas os eventos do React sobem pela árvore até aqui: só vale o que nasceu dentro do visualizador
  const dentro = (e: { currentTarget: Element; target: EventTarget }) => e.currentTarget.contains(e.target as Node);
  function apertou(e: PointerEvent) {
    if (!dentro(e)) return;
    toque.current = { x: e.clientX, y: e.clientY, segurou: false, t: setTimeout(() => { if (toque.current) toque.current.segurou = true; setSegurando(true); }, 250) };
  }
  function moveu(e: PointerEvent) {
    if (!dentro(e)) return;
    const t = toque.current;
    if (t) setArrasto(Math.max(0, e.clientY - t.y));
  }
  function soltou(e: PointerEvent) {
    if (!dentro(e)) return;
    const t = toque.current;
    clearTimeout(t?.t);
    setSegurando(false);
    if (arrasto > 100) fechar();
    setArrasto(0);
  }
  function clicou(e: MouseEvent<HTMLDivElement>) {
    if (!dentro(e)) return;
    const t = toque.current;
    toque.current = null;
    if (t?.segurou || arrasto > 10) return; // segurar e arrastar não contam como toque
    const r = e.currentTarget.getBoundingClientRect();
    if (e.clientX - r.left < r.width / 3) anterior();
    else proximo();
  }
  function alternarSom() {
    somLigado = mudo;
    setMudo(!mudo);
    setDica(false);
  }
  async function apagarStory() {
    if (!story) return;
    try {
      await api(`/stories/${story.id}`, { method: 'DELETE' });
    } catch {
      return setApagar(false);
    }
    setApagar(false);
    if (faixa && faixa.stories.length > 1 && Array.isArray(lista)) {
      setLista(lista.map((f, k) => (k === ci ? { ...f, stories: f.stories.filter((s) => s.id !== story.id) } : f)));
      setSi(Math.max(0, si - (si === faixa.stories.length - 1 ? 1 : 0)));
    } else fechar();
  }

  if (lista === 'carregando') return <div className="visualizador" role="status" aria-label="Carregando"><div className="carregando" /></div>;
  if (lista === 'erro')
    return <div className="visualizador"><div className="caixa-info vis-erro" role="alert"><h2>Não deu para abrir este story</h2><button type="button" className="botao" onClick={carregar}>Tentar de novo</button><button type="button" className="botao fantasma" onClick={fechar}>Voltar ao feed</button></div></div>;
  if (!faixa || !story)
    return <div className="visualizador"><div className="caixa-info vis-erro"><h2>Esse story já saiu do ar</h2><p className="giz2">Stories ficam 24 horas.</p><button type="button" className="botao" onClick={fechar}>Voltar ao feed</button></div></div>;

  return (
    <div
      className={`visualizador ${segurando ? 'pausado' : ''} ${arrasto > 10 ? 'fechando' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label={`Story de ${faixa.clube.nome}`}
      style={arrasto > 10 ? { transform: `translateY(${arrasto}px) scale(${Math.max(0.8, 1 - arrasto / 1500)})`, opacity: Math.max(0.4, 1 - arrasto / 500) } : undefined}
      onPointerDown={apertou}
      onPointerMove={moveu}
      onPointerUp={soltou}
      onPointerCancel={soltou}
      onClick={clicou}
    >
      {story.tipo === 'VIDEO' ? (
        <video key={story.id} ref={video} className="midia" src={story.url} poster={story.capaUrl ?? undefined} playsInline muted autoPlay
          onTimeUpdate={(e) => setProg(e.currentTarget.duration ? e.currentTarget.currentTime / e.currentTarget.duration : 0)}
          onEnded={proximo} onError={() => setFalhou(true)} />
      ) : (
        <img key={story.id} className="midia" src={story.url} alt={`Story de ${faixa.clube.nome}`} onError={() => setFalhou(true)} />
      )}
      {falhou && <div className="caixa-info vis-erro" role="alert" onClick={(e) => e.stopPropagation()}><h2>Não deu para abrir este story</h2><button type="button" className="botao" onClick={() => setFalhou(false)}>Tentar de novo</button></div>}
      <div className="vis-topo" onClick={(e) => e.stopPropagation()}>
        <div className="vis-barras" aria-hidden="true">{faixa.stories.map((s, k) => <i key={s.id}><b style={{ width: `${k < si ? 100 : k === si ? Math.min(100, prog * 100) : 0}%` }} /></i>)}</div>
        <div className="vis-quem">
          {faixa.clube.id === 'cbf' ? <img src="/escudos/cbf.svg" alt="" width="28" height="36" /> : <Escudo src={faixa.clube.escudoUrl} tam={36} />}
          <strong>{faixa.clube.nome}</strong>
          <span className="giz2">{haQuanto(story.criadoEm)}</span>
          {story.tipo === 'VIDEO' && <button type="button" className="vis-botao som" aria-label={mudo ? 'Ligar o som' : 'Desligar o som'} onClick={alternarSom}><span><IcVolume mudo={mudo} /></span></button>}
          <button type="button" className="vis-botao" aria-label="Fechar" onClick={fechar}><IcFechar /></button>
        </div>
        {dica && <span className="vis-dica" role="status">Sem som. Toque no alto-falante para ligar.</span>}
      </div>
      {souAutor && (
        <div className="vis-autor" onClick={(e) => e.stopPropagation()}>
          <button type="button" onClick={() => setFolha(true)}><IcOlho /> {vistos ? `Visto por ${vistos.length}` : 'Visto por'}</button>
          <button type="button" aria-label="Apagar story" onClick={() => setApagar(true)}><IcLixo /></button>
        </div>
      )}
      {folha && (
        <Folha titulo={`Visto por ${vistos?.length ?? 0}`} aoFechar={() => setFolha(false)}>
          <div className="folha-topo"><h2 data-foco tabIndex={-1}>Visto por {vistos?.length ?? 0}</h2><button type="button" aria-label="Fechar" onClick={() => setFolha(false)}><IcFechar /></button></div>
          {vistos?.length === 0 && <p className="giz2">Ninguém viu ainda.</p>}
          <ul className="vistos-lista">{vistos?.map((v) => <li key={v.id}><span className="av32" aria-hidden="true">{v.nome[0]?.toUpperCase()}</span><strong>{v.nome}</strong></li>)}</ul>
        </Folha>
      )}
      {apagar && <Dialogo titulo="Apagar este story?" texto="Ele some para todo mundo e não dá para desfazer." acao="Apagar" perigo voltarRotulo="Cancelar" aoConfirmar={apagarStory} aoVoltar={() => setApagar(false)} />}
    </div>
  );
}
