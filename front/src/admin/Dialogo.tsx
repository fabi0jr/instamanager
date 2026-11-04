import { useEffect, useId, useRef, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
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
    return () => {
      // o botão de origem pode ter sumido (pedido aprovado, técnico tirado): o foco cai no título da tela, não no <body>
      const alvo = antes && antes !== document.body && antes.isConnected ? antes : document.querySelector<HTMLElement>('h1'); // Safari não foca botão ao tocar: body também vale como "sumiu"
      if (alvo) {
        if (alvo.tagName === 'H1') alvo.tabIndex = -1;
        alvo.focus();
      }
    };
  }, []);
  function tecla(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.stopPropagation();
      aoVoltar();
    }
  }
  return createPortal(
    <div className="veu" onClick={aoVoltar}>
      <div role="alertdialog" aria-modal="true" aria-labelledby={id + 't'} aria-describedby={id + 'd'} className="folha dialogo" onClick={(e) => e.stopPropagation()} onKeyDown={tecla}>
        <h2 id={id + 't'}>{titulo}</h2>
        <p id={id + 'd'} className="giz2">{texto}</p>
        <Botao className={perigo ? 'perigo' : ''} onClick={aoConfirmar} carregando={ocupado ? 'Enviando…' : undefined}>{acao}</Botao>
        <button ref={voltar} type="button" className="botao secundario" disabled={ocupado} onClick={aoVoltar}>Voltar</button>
      </div>
    </div>,
    document.body, // fora do #rolagem: acima da barra inferior
  );
}
