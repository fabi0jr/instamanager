import { useEffect, useRef, useState } from 'react';
import { IcPlay, IcVideo, IcVolume } from './icones';
import { mmss } from '../stories/tipos';
import type { Post } from './tipos';
import '../stories/stories.css';

// Capa com play; o vídeo só começa depois do toque, mudo (nada de autoplay com áudio). Toque pausa/retoma; sair da tela pausa.
export function VideoCard({ post }: { post: Post }) {
  const v = post.video!;
  const el = useRef<HTMLVideoElement>(null);
  const caixa = useRef<HTMLDivElement>(null);
  const [tocando, setTocando] = useState(false);
  const [iniciou, setIniciou] = useState(false);
  const [mudo, setMudo] = useState(true);
  const [tempo, setTempo] = useState(0);
  const [falhou, setFalhou] = useState(false);

  // sair da tela (rolar o feed) pausa
  useEffect(() => {
    const alvo = caixa.current;
    if (!alvo || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([e]) => { if (e && !e.isIntersecting) el.current?.pause(); }, { threshold: 0.25 });
    io.observe(alvo);
    return () => io.disconnect();
  }, []);

  function tocar() {
    setFalhou(false);
    setIniciou(true);
    requestAnimationFrame(() => el.current?.play().catch(() => setFalhou(true)));
  }
  function alternar() {
    const x = el.current;
    if (!x) return;
    if (x.paused) x.play().catch(() => setFalhou(true));
    else x.pause();
  }
  return (
    <div className="video-card" ref={caixa}>
      {iniciou ? (
        <video ref={el} src={v.url} poster={v.capaUrl} muted={mudo} playsInline preload="metadata" aria-label="Vídeo do post"
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
