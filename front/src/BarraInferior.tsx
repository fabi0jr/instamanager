import { Icone } from './feed/icones';
import { Link, useCaminho } from './rotas';

// Onda B (docs/design/onda-b.md): no celular Feed · Liga · Postar · Galeria · Perfil (o Clube mora no topo do Perfil);
// a lateral do desktop mantém o Clube, que leva ao clube da pessoa (sem clube, à lista de clubes)
export function BarraInferior({ clubeId, soDesktop }: { clubeId?: string; soDesktop?: boolean }) {
  const caminho = useCaminho();
  const itens = [
    { para: '/', nome: 'Feed', ativo: caminho === '/', ic: "inicio" },
    { para: '/liga', nome: 'Liga', ativo: caminho.startsWith('/liga'), ic: "liga" },
    { para: '/postar', nome: 'Postar', ativo: caminho === '/postar', destaque: true, ic: "novo-post" },
    { para: '/galeria', nome: 'Galeria', ativo: caminho.startsWith('/galeria'), ic: "galeria" },
    { para: clubeId ? `/c/${clubeId}` : '/clubes', nome: 'Clube', soDesktop: true, ativo: caminho === '/clubes' || (!!clubeId && caminho === `/c/${clubeId}`), ic: "escudo" },
    { para: '/perfil', nome: 'Perfil', ativo: caminho.startsWith('/perfil'), ic: "perfil" },
  ] as const;
  return (
    <nav className={`barra-inferior ${soDesktop ? 'so-desktop' : ''}`} aria-label="Principal">
      {/* só no desktop: a lateral leva a marca (o cabeçalho do feed some a partir de 768 px) */}
      <div className="marca-lateral"><img src="/icones/icon-192.png" alt="" width="40" height="40" /><span>InstaManager</span></div>
      {itens.map((i) => (
        <Link key={i.para} para={i.para} className={`${i.ativo ? 'ativo' : ''} ${'destaque' in i ? 'destaque' : ''} ${'soDesktop' in i ? 'item-desktop' : ''}`} aria-current={i.ativo ? 'page' : undefined}>
          <span className="ic"><Icone nome={i.ic} /></span>
          <span className="rotulo">{i.nome}</span>
        </Link>
      ))}
    </nav>
  );
}
