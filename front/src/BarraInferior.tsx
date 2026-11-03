import type { ReactNode } from 'react';
import { Link, useCaminho } from './rotas';

// Ícones do board Icones (grade 24, traço 1,75, sem preenchimento). Paths simples; o desenho final vem do grupo de navegação.
const icone = (d: ReactNode) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {d}
  </svg>
);

const ITENS = [
  { para: '/', nome: 'Início', svg: icone(<path d="M4 11l8-7 8 7v9H4z" />) },
  { para: '/galeria', nome: 'Galeria', svg: icone(<><rect x="4" y="4" width="16" height="16" rx="3" /><circle cx="9" cy="9" r="1.5" /><path d="M20 15l-5-5-9 10" /></>) },
  { para: '/postar', nome: 'Novo post', svg: icone(<><rect x="4" y="4" width="16" height="16" rx="3" /><path d="M12 8v8M8 12h8" /></>) },
  { para: '/clube', nome: 'Clube', svg: icone(<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />) },
  { para: '/perfil', nome: 'Perfil', svg: icone(<><circle cx="12" cy="8" r="4" /><path d="M4 21c1-4 4-6 8-6s7 2 8 6" /></>) },
];

// Clube leva ao clube da pessoa; torcedor (sem clube) não tem esse item
export function BarraInferior({ clubeId }: { clubeId?: string }) {
  const caminho = useCaminho();
  return (
    <nav className="barra-inferior" aria-label="Principal">
      {ITENS.filter((i) => i.para !== '/clube' || clubeId).map((i) => i.para === '/clube' ? { ...i, para: `/c/${clubeId}` } : i).map((i) => (
        <Link key={i.para} para={i.para} aria-label={i.nome} aria-current={caminho === i.para ? 'page' : undefined}>
          {i.svg}
        </Link>
      ))}
    </nav>
  );
}
