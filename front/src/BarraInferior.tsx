import { Icone } from './feed/icones';
import { Link, useCaminho } from './rotas';

// Segue docs/design/feed.md: 5 itens com rótulo, Postar em pílula vermelha, Clube sempre presente.
// Clube leva ao clube da pessoa; sem clube, à lista de clubes
export function BarraInferior({ clubeId, soDesktop }: { clubeId?: string; soDesktop?: boolean }) {
  const caminho = useCaminho();
  const itens = [
    { para: '/', nome: 'Feed', ativo: caminho === '/', ic: "inicio" },
    { para: '/galeria', nome: 'Galeria', ativo: caminho.startsWith('/galeria'), ic: "galeria" },
    { para: '/postar', nome: 'Postar', ativo: caminho === '/postar', destaque: true, ic: "novo-post" },
    { para: clubeId ? `/c/${clubeId}` : '/clubes', nome: 'Clube', ativo: caminho === '/clubes' || (!!clubeId && caminho === `/c/${clubeId}`), ic: "escudo" },
    { para: '/perfil', nome: 'Perfil', ativo: caminho.startsWith('/perfil'), ic: "perfil" },
  ] as const;
  return (
    <nav className={`barra-inferior ${soDesktop ? 'so-desktop' : ''}`} aria-label="Principal">
      {/* só no desktop: a lateral leva a marca (o cabeçalho do feed some a partir de 768 px) */}
      <div className="marca-lateral"><img src="/icones/icon-192.png" alt="" width="40" height="40" /><span>InstaManager</span></div>
      {itens.map((i) => (
        <Link key={i.para} para={i.para} className={`${i.ativo ? 'ativo' : ''} ${'destaque' in i ? 'destaque' : ''}`} aria-current={i.ativo ? 'page' : undefined}>
          <span className="ic"><Icone nome={i.ic} /></span>
          <span className="rotulo">{i.nome}</span>
        </Link>
      ))}
    </nav>
  );
}
