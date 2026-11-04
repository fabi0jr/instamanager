import { useEffect, useState } from 'react';
import { emEdicao, useCaminho } from './rotas';

// O build grava o hash em <meta name="versao"> e em /version.json (plugin no vite.config). Se divergirem, há versão nova no ar.
const atual = () => document.querySelector<HTMLMetaElement>('meta[name=versao]')?.content;

export function AvisoVersao() {
  const [nova, setNova] = useState(false);
  const caminho = useCaminho();
  const escrevendo = emEdicao(caminho); // Atualizar recarrega a página e perderia o rascunho
  useEffect(() => {
    if (!atual()) return; // dev: sem hash
    async function conferir() {
      if (document.visibilityState === 'hidden') return;
      try {
        const r = await fetch('/version.json', { cache: 'no-store' });
        const { versao } = await r.json();
        if (typeof versao === 'string' && versao !== atual()) setNova(true);
      } catch {
        // offline ou resposta estranha: confere na próxima
      }
    }
    conferir();
    document.addEventListener('visibilitychange', conferir);
    return () => document.removeEventListener('visibilitychange', conferir);
  }, []);
  if (!nova || escrevendo) return null;
  return (
    <div role="status" className="faixa-versao">
      <span>Nova versão do InstaManager</span>
      <button type="button" className="botao" onClick={() => location.reload()}>Atualizar</button>
    </div>
  );
}
