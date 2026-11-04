import { useEffect, useState } from 'react';
import { api } from './api/cliente';
import { Icone } from './feed/icones';
import { Link, useCaminho } from './rotas';

// Onda C (docs/design/onda-c.md): no celular Feed · Liga · Postar · Atividade · Perfil; a Galeria mora no topo do feed e no Perfil.
// A lateral do desktop tem também Galeria e Busca (ordem: Feed, Liga, Postar, Galeria, Atividade, Busca, Perfil).
export const textoContador = (n: number) => (n > 9 ? '9+' : String(n));

export function BarraInferior({ soDesktop }: { clubeId?: string; soDesktop?: boolean }) {
  const caminho = useCaminho();
  const [naoLidas, setNaoLidas] = useState(0);
  // atualiza a cada troca de tela; abrir /atividade marca tudo como lido (o contador zera ao sair de lá)
  useEffect(() => {
    if (caminho === '/atividade') return setNaoLidas(0);
    api<{ total: number }>('/atividade/nao-lidas').then((r) => setNaoLidas(Number(r?.total) || 0), () => {});
  }, [caminho]);
  const itens = [
    { para: '/', nome: 'Feed', ativo: caminho === '/', ic: 'inicio' },
    { para: '/liga', nome: 'Liga', ativo: caminho.startsWith('/liga'), ic: 'liga' },
    { para: '/postar', nome: 'Postar', ativo: caminho === '/postar', destaque: true, ic: 'novo-post' },
    { para: '/galeria', nome: 'Galeria', soDesktop: true, ativo: caminho.startsWith('/galeria'), ic: 'galeria' },
    { para: '/atividade', nome: 'Atividade', ativo: caminho === '/atividade', ic: 'atividade', contador: true },
    { para: '/busca', nome: 'Busca', soDesktop: true, ativo: caminho === '/busca', ic: 'busca' },
    { para: '/perfil', nome: 'Perfil', ativo: caminho.startsWith('/perfil'), ic: 'perfil' },
  ] as const;
  return (
    <nav className={`barra-inferior ${soDesktop ? 'so-desktop' : ''}`} aria-label="Principal">
      {/* só no desktop: a lateral leva a marca (o cabeçalho do feed some a partir de 768 px) */}
      <div className="marca-lateral"><img src="/icones/icon-192.png" alt="" width="40" height="40" /><span>InstaManager</span></div>
      {itens.map((i) => (
        <Link key={i.para} para={i.para} className={`${i.ativo ? 'ativo' : ''} ${'destaque' in i ? 'destaque' : ''} ${'soDesktop' in i ? 'item-desktop' : ''}`} aria-current={i.ativo ? 'page' : undefined} aria-label={'contador' in i && naoLidas > 0 ? `Atividade, ${naoLidas} ${naoLidas === 1 ? 'não lida' : 'não lidas'}` : undefined}>
          <span className="ic"><Icone nome={i.ic} />{'contador' in i && naoLidas > 0 && <span className={`contador ${naoLidas > 9 ? "largo" : ""}`} aria-hidden="true">{textoContador(naoLidas)}</span>}</span>
          <span className="rotulo">{i.nome}</span>
        </Link>
      ))}
    </nav>
  );
}
