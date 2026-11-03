import { useEffect, useId, useRef, type KeyboardEvent } from 'react';
import '../feed/feed.css';
import { Botao } from '../conta/ui';

// Confirmação de ação sem volta. O foco abre no "Voltar" (nunca no botão destrutivo), Esc fecha e o foco volta a quem abriu.
export function Dialogo({ titulo, texto, acao, perigo, ocupado, aoConfirmar, aoVoltar }: {
  titulo: string;
  texto: string;
  acao: string;
  perigo?: boolean;
  ocupado?: boolean;
  aoConfirmar: () => void;
  aoVoltar: () => void;
}) {
  const voltar = useRef<HTMLButtonElement>(null);
  const id = useId();
  useEffect(() => {
    const antes = document.activeElement as HTMLElement | null;
    voltar.current?.focus();
    return () => antes?.focus();
  }, []);
  function tecla(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.stopPropagation();
      aoVoltar();
    }
  }
  return (
    <div className="veu" onClick={aoVoltar}>
      <div role="alertdialog" aria-modal="true" aria-labelledby={id + 't'} aria-describedby={id + 'd'} className="folha dialogo" onClick={(e) => e.stopPropagation()} onKeyDown={tecla}>
        <h2 id={id + 't'}>{titulo}</h2>
        <p id={id + 'd'} className="giz2">{texto}</p>
        <Botao className={perigo ? 'perigo' : ''} onClick={aoConfirmar} carregando={ocupado ? 'Enviando…' : undefined}>{acao}</Botao>
        <button ref={voltar} type="button" className="botao secundario" disabled={ocupado} onClick={aoVoltar}>Voltar</button>
      </div>
    </div>
  );
}

// Aviso rápido de sucesso; some sozinho (o chamador zera o texto)
export function usarAvisoRapido() {
  return { toast: (set: (t: string) => void, t: string) => { set(t); setTimeout(() => set(''), 4000); } };
}
