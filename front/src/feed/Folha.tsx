import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

// Folha de baixo / janela central. Foco entra ao abrir (campo [data-foco] ou 1º botão) e volta a quem abriu; Esc fecha.
// Vai por portal para o <body>: dentro do #rolagem ela ficaria num contexto de empilhamento abaixo da barra inferior (que é irmã dele).
// No iOS o teclado não encolhe a janela de layout: o véu acompanha o visualViewport para o rodapé (campo Comentar) ficar acima do teclado.
// Com portal, folha aninhada deixa de ser descendente no DOM: o "de cima" é a de maior nível na árvore do React.
const Nivel = createContext(0);
const abertas = new Set<number>();

export function Folha({ titulo, aoFechar, children, alta, centro }: { titulo: string; aoFechar: () => void; children: ReactNode; alta?: boolean; centro?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const nivel = useContext(Nivel) + 1;
  useEffect(() => {
    abertas.add(nivel);
    return () => void abertas.delete(nivel);
  }, [nivel]);
  useEffect(() => {
    const antes = document.activeElement as HTMLElement | null;
    (ref.current?.querySelector<HTMLElement>('[data-foco]') ?? ref.current?.querySelector<HTMLElement>('button, textarea, input'))?.focus();
    return () => antes?.focus();
  }, []);
  // Esc no documento (o foco pode estar fora da folha); com folhas aninhadas só a de cima (a última do DOM) fecha
  const fechar = useRef(aoFechar);
  fechar.current = aoFechar;
  useEffect(() => {
    const tecla = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape' && nivel === Math.max(...abertas)) fechar.current();
    };
    document.addEventListener('keydown', tecla);
    return () => document.removeEventListener('keydown', tecla);
  }, [nivel]);
  const veu = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const vv = window.visualViewport;
    const el = veu.current;
    if (!vv || !el) return;
    const ajustar = () => {
      el.style.top = `${vv.offsetTop}px`;
      el.style.height = `${vv.height}px`;
      el.style.bottom = 'auto';
    };
    ajustar();
    vv.addEventListener('resize', ajustar);
    vv.addEventListener('scroll', ajustar);
    return () => {
      vv.removeEventListener('resize', ajustar);
      vv.removeEventListener('scroll', ajustar);
    };
  }, []);
  return createPortal(
    <div ref={veu} className={`veu ${centro ? 'veu-centro' : ''}`} onClick={aoFechar}>
      <div ref={ref} role="dialog" aria-modal="true" aria-label={titulo} className={`folha ${alta ? 'alta' : ''} ${centro ? 'centro' : ''}`} onClick={(e) => e.stopPropagation()}>
        <Nivel.Provider value={nivel}>{children}</Nivel.Provider>
      </div>
    </div>,
    document.body,
  );
}
