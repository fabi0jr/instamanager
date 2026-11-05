import { useLayoutEffect, useRef, useState } from 'react';
import { tamanhoTexto } from './tipos';

const TAMANHOS = ['t56', 't40', 't30', 't24'];

// <p> que começa no tamanho de tamanhoTexto e desce (t56 → t40 → t30 → t24) enquanto transborda; refaz ao mudar o texto e no resize
export function TextoAjustado({ texto, classe }: { texto: string; classe: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const inicio = TAMANHOS.indexOf(tamanhoTexto(texto));
  const [s, setS] = useState({ texto, n: inicio, larg: 0 });
  const n = s.texto === texto ? Math.max(s.n, inicio) : inicio;
  useLayoutEffect(() => {
    const el = ref.current;
    if (el && n < TAMANHOS.length - 1 && el.scrollHeight > el.clientHeight) setS((a) => ({ ...a, texto, n: n + 1 }));
  }, [texto, n, s.larg]);
  useLayoutEffect(() => {
    const refazer = () => setS({ texto, n: inicio, larg: window.innerWidth * 10000 + window.innerHeight });
    window.addEventListener('resize', refazer);
    return () => window.removeEventListener('resize', refazer);
  }, [texto, inicio]);
  return <p ref={ref} className={`${classe} ${TAMANHOS[n]}`}>{texto}</p>;
}
