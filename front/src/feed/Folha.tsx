import { useEffect, useRef, type KeyboardEvent, type ReactNode } from 'react';

// Folha de baixo / janela central. Foco entra ao abrir (campo [data-foco] ou 1º botão) e volta a quem abriu; Esc fecha.
export function Folha({ titulo, aoFechar, children, alta }: { titulo: string; aoFechar: () => void; children: ReactNode; alta?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const antes = document.activeElement as HTMLElement | null;
    (ref.current?.querySelector<HTMLElement>('[data-foco]') ?? ref.current?.querySelector<HTMLElement>('button, textarea, input'))?.focus();
    return () => antes?.focus();
  }, []);
  function tecla(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.stopPropagation(); // Folha aninhada fecha só ela
      aoFechar();
    }
  }
  return (
    <div className="veu" onClick={aoFechar}>
      <div ref={ref} role="dialog" aria-modal="true" aria-label={titulo} className={`folha ${alta ? 'alta' : ''}`} onClick={(e) => e.stopPropagation()} onKeyDown={tecla}>
        {children}
      </div>
    </div>
  );
}
