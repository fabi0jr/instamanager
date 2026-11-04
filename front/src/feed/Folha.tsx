import { useEffect, useRef, type ReactNode } from 'react';

// Folha de baixo / janela central. Foco entra ao abrir (campo [data-foco] ou 1º botão) e volta a quem abriu; Esc fecha.
export function Folha({ titulo, aoFechar, children, alta, centro }: { titulo: string; aoFechar: () => void; children: ReactNode; alta?: boolean; centro?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
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
      const veus = document.querySelectorAll('.veu');
      if (e.key === 'Escape' && veus[veus.length - 1] === ref.current?.parentElement) fechar.current();
    };
    document.addEventListener('keydown', tecla);
    return () => document.removeEventListener('keydown', tecla);
  }, []);
  return (
    <div className={`veu ${centro ? 'veu-centro' : ''}`} onClick={aoFechar}>
      <div ref={ref} role="dialog" aria-modal="true" aria-label={titulo} className={`folha ${alta ? 'alta' : ''} ${centro ? 'centro' : ''}`} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}
