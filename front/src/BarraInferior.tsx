import type { ReactNode } from 'react';
import { Link, useCaminho } from './rotas';

// Segue docs/design/feed.md: 5 itens com rótulo, Postar em pílula vermelha, Clube sempre presente.
// Ícones: grade 24, traço 1,75 (paths próprios; trocar pelos SVG do board Icones quando forem exportados).
const icone = (d: ReactNode) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {d}
  </svg>
);

// Clube leva ao clube da pessoa; sem clube, à lista de clubes
export function BarraInferior({ clubeId }: { clubeId?: string }) {
  const caminho = useCaminho();
  const itens = [
    { para: '/', nome: 'Feed', ativo: caminho === '/', svg: icone(<path d="M4 11l8-7 8 7v9H4z" />) },
    { para: '/galeria', nome: 'Galeria', ativo: caminho.startsWith('/galeria'), svg: icone(<><rect x="4" y="4" width="16" height="16" rx="3" /><circle cx="9" cy="9" r="1.5" /><path d="M20 15l-5-5-9 10" /></>) },
    { para: '/postar', nome: 'Postar', ativo: caminho === '/postar', destaque: true, svg: icone(<path d="M12 6v12M6 12h12" />) },
    { para: clubeId ? `/c/${clubeId}` : '/clubes', nome: 'Clube', ativo: caminho === '/clubes' || (!!clubeId && caminho === `/c/${clubeId}`), svg: icone(<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />) },
    { para: '/perfil', nome: 'Perfil', ativo: caminho.startsWith('/perfil'), svg: icone(<><circle cx="12" cy="8" r="4" /><path d="M4 21c1-4 4-6 8-6s7 2 8 6" /></>) },
  ];
  return (
    <nav className="barra-inferior" aria-label="Principal">
      {itens.map((i) => (
        <Link key={i.para} para={i.para} className={`${i.ativo ? 'ativo' : ''} ${i.destaque ? 'destaque' : ''}`} aria-current={i.ativo ? 'page' : undefined}>
          <span className="ic">{i.svg}</span>
          <span className="rotulo">{i.nome}</span>
        </Link>
      ))}
    </nav>
  );
}
