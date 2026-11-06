import { useEffect, useRef, useState } from 'react';
import { IcPlay, IcVideo, IcVolume } from './icones';
import { mmss } from '../stories/tipos';
import type { Post } from './tipos';
import '../stories/stories.css';

const VISIVEL = 0.6; // fração do cartão na tela para tocar sozinho
const SAIU = 0.25; // abaixo disso o cartão saiu da tela
// Só um vídeo por vez. Cada cartão informa o quanto aparece; a vez é de quem a pessoa tocou (enquanto estiver na tela)
// ou, sem toque, do mais visível (empate: o primeiro a chegar).
const razoes = new Map<symbol, number>();
const ouvintes = new Set<() => void>();
let manual: symbol | null = null;
function avisar() { ouvintes.forEach((f) => f()); }
function informar(id: symbol, r: number) {
  if (r > 0) razoes.set(id, r);
  else razoes.delete(id);
  if (r < SAIU && manual === id) manual = null;
  avisar();
}
function tocarManual(id: symbol) { manual = id; avisar(); }
function soltarVez(id: symbol) { if (manual === id) { manual = null; avisar(); } } // pausou: o mais visível volta a tocar
function vez() {
  if (manual) return manual;
  let id: symbol | null = null;
  let melhor = VISIVEL - 1e-9;
  for (const [k, r] of razoes) if (r > melhor) { id = k; melhor = r; }
  return id;
}
// economia de dados ou movimento reduzido: nada de autoplay, só capa + play
const semAutoplay = () =>
  (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true ||
  (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);

// Capa até o cartão ficar >= 60% visível; aí o <video> monta e toca mudo em loop. Perdeu a vez ou saiu da tela: pausa,
// desmonta, volta à capa e ao mudo (som só com novo toque). Quem pausou fica pausado até sair e voltar.
export function VideoCard({ post }: { post: Post }) {
  const v = post.video!;
  const el = useRef<HTMLVideoElement>(null);
  const caixa = useRef<HTMLDivElement>(null);
  const meuId = useRef(Symbol('video'));
  const pausouEu = useRef(false);
  const auto = useRef(!semAutoplay());
  const [tocando, setTocando] = useState(false);
  const [iniciou, setIniciou] = useState(false);
  const [mudo, setMudo] = useState(true);
  const [tempo, setTempo] = useState(0);
  const [falhou, setFalhou] = useState(false);
  const [ativo, setAtivo] = useState(false);
  const [pedidos, setPedidos] = useState(0); // cada toque em play: monta e toca direto, mesmo que o estado de 'ativo' não mude

  useEffect(() => {
    const alvo = caixa.current;
    const id = meuId.current;
    const atualizar = () => setAtivo(vez() === id);
    ouvintes.add(atualizar);
    const limpar = () => { ouvintes.delete(atualizar); informar(id, 0); };
    if (!alvo || typeof IntersectionObserver === 'undefined') return limpar;
    const io = new IntersectionObserver(
      (es) => {
        for (const e of es) informar(id, e.isIntersecting ? e.intersectionRatio : 0);
        if (es.some((e) => e.intersectionRatio < SAIU)) setMudo(true); // som ligado na capa vale só para este toque
      },
      { root: document.getElementById('rolagem'), threshold: Array.from({ length: 21 }, (_, i) => i / 20) },
    );
    io.observe(alvo);
    return () => { io.disconnect(); limpar(); };
  }, []);

  useEffect(() => {
    if (!ativo) {
      pausouEu.current = false;
      el.current?.pause();
      setIniciou(false); setTocando(false); setTempo(0); setMudo(true);
      return;
    }
    if (!auto.current || manual === meuId.current || pausouEu.current) return; // toque manual toca pelo efeito de `pedidos`
    if (!iniciou) { setMudo(true); setIniciou(true); return; } // começou sozinho: sempre mudo. O <video> monta agora e este efeito roda de novo
    el.current?.play().catch(() => {}); // autoplay barrado: fica o botão de play, sem erro
  }, [ativo, iniciou]);

  useEffect(() => {
    if (pedidos) el.current?.play().catch(() => setFalhou(true)); // o <video> já montou nesta renderização
  }, [pedidos]);

  function tocar() {
    setFalhou(false);
    pausouEu.current = false;
    setIniciou(true);
    setPedidos((n) => n + 1);
    tocarManual(meuId.current);
  }
  function alternar() {
    const x = el.current;
    if (!x) return;
    if (x.paused) {
      pausouEu.current = false;
      tocarManual(meuId.current);
      x.play().catch(() => setFalhou(true));
    } else { pausouEu.current = true; x.pause(); soltarVez(meuId.current); }
  }
  return (
    <div className="video-card" ref={caixa}>
      {iniciou ? (
        <video ref={el} src={v.url} poster={v.capaUrl} muted={mudo} loop playsInline preload="metadata" aria-label="Vídeo do post"
          onClick={alternar} onPlay={() => setTocando(true)} onPause={() => setTocando(false)} onEnded={() => setTocando(false)}
          onTimeUpdate={(e) => setTempo(e.currentTarget.currentTime)} onError={() => { setFalhou(true); setTocando(false); }} />
      ) : (
        <img src={v.capaUrl} alt={`Capa do vídeo de ${post.clube.nome}, ${mmss(v.duracaoS)}`} loading="lazy" />
      )}
      {!tocando && !falhou && <button type="button" className="video-play" aria-label="Tocar vídeo" onClick={iniciou ? alternar : tocar}><IcPlay /></button>}
      <span className="video-dur"><IcVideo />{mmss(tocando || tempo > 0 ? tempo : v.duracaoS)}</span>
      <button type="button" className="video-som" aria-label={mudo ? 'Ligar o som' : 'Desligar o som'} onClick={() => setMudo(!mudo)}><span><IcVolume mudo={mudo} /></span></button>
      {tocando && v.duracaoS > 0 && <div className="video-prog" aria-hidden="true"><i style={{ width: `${Math.min(100, (tempo / v.duracaoS) * 100)}%` }} /></div>}
      {falhou && <button type="button" className="video-falha" onClick={tocar}><span>Não deu para tocar. Toque para tentar de novo.</span></button>}
    </div>
  );
}
