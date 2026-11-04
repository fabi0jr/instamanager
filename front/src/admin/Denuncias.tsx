import { useMemo, useState } from 'react';
import { api, ErroApi } from '../api/cliente';
import { Botao } from '../conta/ui';
import { haQuanto } from '../feed/tipos';
import { usePaginado } from '../paginado';
import { Link } from '../rotas';
import { Topo } from './Admin';
import { Dialogo } from './Dialogo';

type Denuncia = {
  id: string;
  criadoEm: string;
  motivo: string | null;
  denunciante: { id: string; nome: string };
  post: { id: string; legenda: string; texto: string | null; clubeId: string } | null;
  comentario: { id: string; texto: string; postId: string } | null;
};
// várias denúncias do mesmo item viram um cartão só
type Grupo = { chave: string; tipo: 'post' | 'comentario'; alvoId: string; postId: string; resumo: string; clubeId?: string; denuncias: Denuncia[] };

function agrupar(lista: Denuncia[]): Grupo[] {
  const mapa = new Map<string, Grupo>();
  for (const d of lista) {
    const tipo = d.post ? 'post' : 'comentario';
    const alvoId = d.post?.id ?? d.comentario!.id;
    const chave = `${tipo}:${alvoId}`;
    const g = mapa.get(chave);
    if (g) g.denuncias.push(d);
    else mapa.set(chave, { chave, tipo, alvoId, postId: d.post?.id ?? d.comentario!.postId, resumo: d.post ? d.post.texto || d.post.legenda : d.comentario!.texto, clubeId: d.post?.clubeId, denuncias: [d] });
  }
  return [...mapa.values()];
}

export function Denuncias() {
  const lista = usePaginado<Denuncia>('/admin/denuncias', { abertas: '1' });
  const grupos = useMemo(() => agrupar(lista.itens), [lista.itens]);
  const [apagar, setApagar] = useState<Grupo | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [toast, setToast] = useState('');
  const avisar = (t: string) => {
    setToast(t);
    setTimeout(() => setToast(''), 4000);
  };

  // Ocultar e Apagar já resolvem a denúncia (o back não faz isso sozinho); Ignorar só resolve
  async function agir(g: Grupo, acao: 'ocultar' | 'apagar' | 'ignorar') {
    setOcupado(true);
    try {
      if (acao === 'ocultar') await api(g.tipo === 'post' ? `/admin/posts/${g.alvoId}/ocultar` : `/admin/comentarios/${g.alvoId}/ocultar`, { method: 'PUT' });
      if (acao === 'apagar') await api(g.tipo === 'post' ? `/posts/${g.alvoId}` : `/comentarios/${g.alvoId}`, { method: 'DELETE' });
      // apagar leva as denúncias junto (cascata no back): resolver depois dá 404, e isso é sucesso
      await Promise.all(
        g.denuncias.map((d) =>
          api(`/admin/denuncias/${d.id}/resolver`, { method: 'POST' }).catch((e) => {
            if (!(e instanceof ErroApi && e.status === 404)) throw e;
          }),
        ),
      );
      const ids = new Set(g.denuncias.map((d) => d.id));
      lista.setItens((l) => l.filter((d) => !ids.has(d.id)));
      avisar(acao === 'ignorar' ? 'Denúncia ignorada.' : `${g.tipo === 'post' ? 'Post' : 'Comentário'} ${acao === 'ocultar' ? 'oculto' : 'apagado'}.`);
    } catch {
      avisar('Não deu para completar. Confira a conexão e tente de novo.');
    } finally {
      setOcupado(false);
      setApagar(null);
    }
  }

  return (
    <div className="tela admin">
      <Topo titulo="Denúncias" voltar />
      {lista.estado === 'carregando' && <div aria-busy="true">{[0, 1].map((n) => <div key={n} className="esqueleto" style={{ height: 140, marginBottom: 8 }} />)}</div>}
      {lista.estado === 'erro' && (
        <div className="caixa-info" role="alert">
          <h2>Não deu para carregar as denúncias</h2>
          <Botao variante="secundario" onClick={lista.recarregar}>Tentar de novo</Botao>
        </div>
      )}
      {lista.estado === 'ok' && grupos.length === 0 && (
        <div className="caixa-info"><h2>Sem denúncias abertas</h2></div>
      )}
      <ul role="list" className="pedidos">
        {grupos.map((g) => (
          <li key={g.chave} className="cartao-pedido">
            <div className="quem">
              <span className="pilula-admin">{g.tipo === 'post' ? 'Post' : 'Comentário'}</span>
              {g.clubeId && <span className="giz2 mini">{g.clubeId}</span>}
              {g.denuncias.length > 1 && <strong>{g.denuncias.length} denúncias</strong>}
            </div>
            <Link para={`/p/${g.postId}`} className="previa-denuncia"><span className="corta2">{g.resumo || '(sem texto)'}</span></Link>
            {g.denuncias.map((d) => (
              <p key={d.id} className="giz2 mini">
                Denunciado por {d.denunciante.nome} · {haQuanto(d.criadoEm)} · {d.motivo ? `Motivo: ${d.motivo}` : 'Sem motivo'}
              </p>
            ))}
            <div className="duas-acoes">
              <Botao variante="secundario" disabled={ocupado} onClick={() => agir(g, 'ocultar')}>Ocultar</Botao>
              <Botao variante="fantasma" disabled={ocupado} onClick={() => setApagar(g)}>Apagar</Botao>
              <button type="button" className="link" disabled={ocupado} onClick={() => agir(g, 'ignorar')}>Ignorar</button>
            </div>
          </li>
        ))}
      </ul>
      {lista.erroMais && <div className="caixa-info" role="alert"><p>Não deu para carregar mais.</p><Botao variante="secundario" onClick={lista.maisUm}>Tentar de novo</Botao></div>}
      <div ref={lista.fim} />
      {apagar && (
        <Dialogo
          titulo={apagar.tipo === 'post' ? 'Apagar este post?' : 'Apagar este comentário?'}
          texto={apagar.tipo === 'post' ? 'As imagens, as reações e os comentários também somem. Não dá para desfazer.' : 'Não dá para desfazer.'}
          acao="Apagar"
          perigo
          ocupado={ocupado}
          aoConfirmar={() => agir(apagar, 'apagar')}
          aoVoltar={() => setApagar(null)}
        />
      )}
      <div role="status" className={toast ? 'toast' : 'sr'}>{toast}</div>
    </div>
  );
}
