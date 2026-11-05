import { useEffect, useState } from 'react';
import { api, type Me } from '../api/cliente';
import { Link, navegar } from '../rotas';
import './admin.css';
import { Clubes } from './Clubes';
import { Convite } from './Convite';
import { CopaFase, CopaFases } from './Copa';
import { Denuncias } from './Denuncias';
import { Pedidos } from './Pedidos';
import { RodadaEditar, RodadasLista } from './Rodadas';
import { Mcp } from './Mcp';

export const Topo = ({ titulo, voltar }: { titulo: string; voltar?: boolean }) => (
  <>
    {voltar && <Link para="/admin" className="voltar-admin">‹ Administração</Link>}
    <header className="topo-admin">
      <h1>{titulo}</h1>
      <span className="pilula-admin">Admin</span>
    </header>
  </>
);

function Inicio() {
  const [pedidos, setPedidos] = useState<number>();
  const [denuncias, setDenuncias] = useState<{ n: number; mais: boolean }>();
  const [codigo, setCodigo] = useState<string>();
  const [clubes, setClubes] = useState<{ com: number; total: number }>();
  useEffect(() => {
    api<unknown[]>('/admin/trocas?status=PENDENTE').then((l) => setPedidos(l.length), () => undefined);
    api<{ itens: unknown[]; proximo: string | null }>('/admin/denuncias?abertas=1').then((p) => setDenuncias({ n: p.itens.length, mais: !!p.proximo }), () => undefined);
    api<{ codigo: string | null }>('/admin/convite').then((c) => setCodigo(c.codigo ?? undefined), () => undefined);
    api<{ tecnico: unknown }[]>('/clubes').then((l) => setClubes({ com: l.filter((c) => c.tecnico).length, total: l.length }), () => undefined);
  }, []);
  return (
    <div className="tela admin">
      <Topo titulo="Administração" />
      <nav className="linhas" aria-label="Administração">
        <Link para="/admin/pedidos" className="linha-config">
          <span>Pedidos de troca</span>
          {!!pedidos && <span className="selo" aria-label={`${pedidos} ${pedidos === 1 ? 'pedido pendente' : 'pedidos pendentes'}`}>{pedidos}</span>}
          <span aria-hidden="true">›</span>
        </Link>
        <Link para="/admin/denuncias" className="linha-config">
          <span>Denúncias</span>
          {!!denuncias?.n && <span className="selo" aria-label={`${denuncias.n}${denuncias.mais ? ' ou mais' : ''} ${denuncias.n === 1 && !denuncias.mais ? 'denúncia aberta' : 'denúncias abertas'}`}>{denuncias.n}{denuncias.mais && '+'}</span>}
          <span aria-hidden="true">›</span>
        </Link>
        <Link para="/admin/convite" className="linha-config">
          <span>Código de convite</span>
          {codigo && <span className="giz2">{codigo}</span>}
          <span aria-hidden="true">›</span>
        </Link>
        <Link para="/admin/rodadas" className="linha-config"><span>Rodadas</span><span aria-hidden="true">›</span></Link>
        <Link para="/admin/copa" className="linha-config"><span>Copa do Brasil</span><span aria-hidden="true">›</span></Link>
        <Link para="/admin/clubes" className="linha-config">
          <span>Clubes e técnicos</span>
          {clubes && <span className="giz2">{clubes.com} de {clubes.total} com técnico</span>}
          <span aria-hidden="true">›</span>
        </Link>
        <Link para="/admin/mcp" className="linha-config"><span>Ações da CBF via MCP</span><span aria-hidden="true">›</span></Link>
      </nav>
    </div>
  );
}

// /admin e as três telas de dentro; quem não é admin volta ao feed sem aviso (a API também recusa)
export function Admin({ me, caminho }: { me: Me; caminho: string }) {
  useEffect(() => {
    if (!me.isAdmin) navegar('/');
  }, [me.isAdmin]);
  if (!me.isAdmin) return null;
  if (caminho === '/admin/pedidos') return <Pedidos />;
  if (caminho === '/admin/denuncias') return <Denuncias />;
  if (caminho === '/admin/convite') return <Convite />;
  if (caminho === '/admin/clubes') return <Clubes />;
  if (caminho === '/admin/rodadas') return <RodadasLista />;
  const rodada = caminho.match(/^\/admin\/rodadas\/(\d+)$/);
  if (rodada) return <RodadaEditar n={Number(rodada[1])} />;
  if (caminho === '/admin/copa') return <CopaFases />;
  const fase = caminho.match(/^\/admin\/copa\/([^/]+)$/);
  if (fase) return <CopaFase id={decodeURIComponent(fase[1])} />;
  if (caminho === '/admin/mcp') return <Mcp />;
  return <Inicio />;
}
