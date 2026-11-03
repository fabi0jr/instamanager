import { useState } from 'react';

export const LIMITE_LEGENDA = 2200;
export const LIMITE_PROMPT = 4000;

export function Contador({ texto, limite }: { texto: string; limite: number }) {
  const n = texto.length;
  const estouro = n - limite;
  return (
    <span className={estouro > 0 ? 'contador-txt erro-txt' : 'contador-txt giz2'}>
      {estouro > 0 ? `${n}/${limite}. Corte ${estouro} caracteres.` : `${n}/${limite}`}
    </span>
  );
}

type Linha = { id: string; miniUrl: string };
// Uma linha por imagem; só um prompt aberto por vez (abrir outro fecha este e guarda o texto)
export function LinhasPrompt({ linhas, prompts, aoMudar, desabilitado }: { linhas: Linha[]; prompts: string[]; aoMudar: (i: number, v: string) => void; desabilitado?: boolean }) {
  const [aberto, setAberto] = useState<number | null>(null);
  const [grande, setGrande] = useState<string | null>(null);
  return (
    <section>
      <h2>Prompts, se quiser</h2>
      <p className="giz2">Cole o prompt que gerou cada imagem. Ele vai para a galeria, com botão de copiar.</p>
      {linhas.map((l, i) => (
        <div key={l.id} className="linha-prompt">
          <button type="button" className="mini-btn" aria-label={`Ver imagem ${i + 1}`} onClick={() => setGrande(l.miniUrl)}>
            <img src={l.miniUrl} alt="" width="56" height="56" />
          </button>
          <div className="corpo">
            <strong>Imagem {i + 1}{i === 0 && ' · capa'}</strong>
            {aberto === i ? (
              <>
                <textarea aria-label={`Prompt da imagem ${i + 1}`} data-foco rows={3} value={prompts[i]} disabled={desabilitado} aria-invalid={prompts[i].length > LIMITE_PROMPT || undefined} onChange={(e) => aoMudar(i, e.target.value)} />
                <Contador texto={prompts[i]} limite={LIMITE_PROMPT} />
              </>
            ) : (
              <>
                {prompts[i] && <p className="prompt-resumo">{prompts[i]}</p>}
                <button type="button" className="link giz2" disabled={desabilitado} onClick={() => setAberto(i)}>
                  {prompts[i] ? 'Editar prompt' : 'Adicionar prompt'}
                </button>
              </>
            )}
          </div>
        </div>
      ))}
      {grande && (
        <div className="veu" onClick={() => setGrande(null)} role="dialog" aria-modal="true" aria-label="Imagem">
          <img className="grande" src={grande} alt="" />
        </div>
      )}
    </section>
  );
}
