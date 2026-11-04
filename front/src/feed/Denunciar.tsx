import { useState } from 'react';
import { api } from '../api/cliente';
import { Folha } from './Folha';
import { Contador } from '../postar/LinhasPrompt';

const LIMITE_MOTIVO = 300;

// Folha de denúncia (post ou comentário): motivo opcional; o admin recebe, ninguém mais vê quem denunciou
export function Denunciar({ alvo, aoFechar, aoEnviada }: { alvo: { postId: string } | { commentId: string }; aoFechar: () => void; aoEnviada: () => void }) {
  const [motivo, setMotivo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState(false);
  const titulo = 'postId' in alvo ? 'Denunciar post' : 'Denunciar comentário';

  async function enviar() {
    setErro(false);
    setEnviando(true);
    try {
      await api('/denuncias', { method: 'POST', body: JSON.stringify({ ...alvo, ...(motivo.trim() && { motivo: motivo.trim() }) }) });
      aoEnviada();
    } catch {
      setErro(true);
      setEnviando(false);
    }
  }

  return (
    <Folha titulo={titulo} aoFechar={aoFechar}>
      <div className="alca" aria-hidden="true" />
      <h2>{titulo}</h2>
      <p className="giz2">O admin recebe a denúncia. Ninguém mais vê quem denunciou.</p>
      <label htmlFor="motivo-denuncia">Motivo (opcional)</label>
      <textarea id="motivo-denuncia" data-foco rows={3} value={motivo} disabled={enviando} aria-invalid={motivo.length > LIMITE_MOTIVO || undefined} onChange={(e) => setMotivo(e.target.value)} />
      <Contador texto={motivo} limite={LIMITE_MOTIVO} />
      {erro && <p role="alert" className="erro-txt">Não deu para enviar a denúncia. Tente de novo.</p>}
      <button type="button" className="botao" disabled={enviando || motivo.length > LIMITE_MOTIVO} onClick={enviar}>{enviando ? 'Enviando…' : 'Enviar denúncia'}</button>
      <button type="button" className="botao fantasma" onClick={aoFechar}>Cancelar</button>
    </Folha>
  );
}
