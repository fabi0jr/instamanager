import { useEffect, useRef, useState } from 'react';
import { IcPlay, IcVideo, IcVolume } from './icones';
import { mmss } from '../stories/tipos';
import type { Post } from './tipos';
import '../stories/stories.css';

const VISIVEL = 0.6; // fração do cartão na tela para tocar sozinho
// Só um vídeo por vez: cada cartão informa o quanto aparece; toca o mais visível (empate: o primeiro a chegar).
const razoes = new Map<symbol, number>();
const ouvintes = new Set<() => void>();
function informar(id: symbol, r: number) {
  if (r > 0) razoes.set(id, r);
  else razoes.delete(id);
  ouvintes.forEach((f) => f());
}
function campeao() {
  let id: symbol | null = null;
  let melhor = VISIVEL - 1e-9;
  for (const [k, r] of razoes) if (r > melhor) { id = k; melhor = r; }
  return id;
}
// economia de dados ou movimento reduzido: nada de autoplay, só capa + play
const semAutoplay = () =>
  (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true ||
  (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);

// Capa até o cartão ficar >= 60% visível; aí o <video> monta e toca mudo em loop, e pausa ao sair. Quem pausou fica pausado até sair e voltar.
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

  useEffect(() => {
    const alvo = caixa.current;
    const id = meuId.current;
    if (!alvo || typeof IntersectionObserver === 'undefined') return;
    const atualizar = () => setAtivo(campeao() === id);
    ouvintes.add(atualizar);
    const io = new IntersectionObserver(
      (es) => {
        for (const e of es) informar(id, e.isIntersecting ? e.intersectionRatio : 0);
        if (!auto.current && es.some((e) => e.intersectionRatio < 0.25)) el.current?.pause(); // sem autoplay: só pausa ao sair
      },
      { root: document.getElementById('rolagem'), threshold: Array.from({ length: 21 }, (_, i) => i / 20) },
    );
    io.observe(alvo);
    return () => { io.disconnect(); ouvintes.delete(atualizar); informar(id, 0); };
  }, []);

  useEffect(() => {
    if (!auto.current) return;
    if (!ativo) { pausouEu.current = false; el.current?.pause(); return; }
    if (pausouEu.current) return;
    if (!iniciou) { setIniciou(true); return; } // o <video> monta agora; este efeito roda de novo
    el.current?.play().catch(() => {}); // navegador barrou o autoplay: fica o botão de play, sem erro
  }, [ativo, iniciou]);

  function tocar() {
    setFalhou(false);
    setIniciou(true);
    requestAnimationFrame(() => el.current?.play().catch(() => setFalhou(true)));
  }
  function alternar() {
    const x = el.current;
    if (!x) return;
    if (x.paused) { pausouEu.current = false; x.play().catch(() => setFalhou(true)); }
    else { pausouEu.current = true; x.pause(); }
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
