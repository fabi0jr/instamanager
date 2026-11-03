import { useCallback, useEffect, useState } from 'react';
import { api, ErroApi, type ClubeMini } from '../api/cliente';
import { Botao } from '../conta/ui';
import { haQuanto } from '../feed/tipos';
import { Topo } from './Admin';
import { Dialogo } from './Dialogo';

type Pedido = {
  id: string;
  tipo: 'SAIR' | 'ASSUMIR';
  status: string;
  criadoEm: string;
  usuario: { id: string; nome: string };
  clubeAtual: ClubeMini | null;
  clubeDesejado: ClubeMini | null;
};
type Item = Pedido & { ocupado?: boolean };
type Decisao = { pedido: Item; acao: 'aprovar' | 'recusar' };

function textoAprovar(p: Pedido) {
  const sai = p.clubeAtual && `sai do ${p.clubeAtual.nome}`;
  if (p.tipo === 'SAIR') return `${p.usuario.nome} ${sai ?? 'sai do clube'} e vira torcedor. O clube fica com vaga aberta e os posts antigos ficam onde estão.`;
  const assume = `assume o ${p.clubeDesejado?.nome ?? 'clube'}`;
  return `${p.usuario.nome} ${sai ? `${sai} e ${assume}` : assume}. O histórico ${sai ? 'dos dois clubes é atualizado' : 'do clube é atualizado'} e os posts antigos ficam onde estão.`;
}

export function Pedidos() {
  const [lista, setLista] = useState<Item[] | 'carregando' | 'erro'>('carregando');
  const [decisao, setDecisao] = useState<Decisao | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [toast, setToast] = useState('');

  const carregar = useCallback(() => {
    setLista('carregando');
    api<Pedido[]>('/admin/trocas?status=PENDENTE').then(setLista, () => setLista('erro'));
  }, []);
  useEffect(carregar, [carregar]);

  const avisar = (t: string) => {
    setToast(t);
    setTimeout(() => setToast(''), 4000);
  };
  const tirar = (id: string) => setLista((l) => (Array.isArray(l) ? l.filter((p) => p.id !== id) : l));

  async function confirmar() {
    if (!decisao) return;
    const { pedido, acao } = decisao;
    setEnviando(true);
    try {
      await api(`/admin/trocas/${pedido.id}/${acao === 'aprovar' ? 'aprovar' : 'recusar'}`, { method: 'POST' });
      tirar(pedido.id);
      avisar(
        acao === 'recusar'
          ? 'Pedido recusado.'
          : pedido.tipo === 'SAIR'
            ? `Troca aprovada. ${pedido.usuario.nome} agora é torcedor.`
            : `Troca aprovada. ${pedido.usuario.nome} agora é técnico do ${pedido.clubeDesejado?.nome ?? 'clube'}.`,
      );
    } catch (e) {
      if (e instanceof ErroApi && e.codigo === 'CLUBE_OCUPADO') setLista((l) => (Array.isArray(l) ? l.map((p) => (p.id === pedido.id ? { ...p, ocupado: true } : p)) : l));
      else if (e instanceof ErroApi && e.codigo === 'TROCA_JA_DECIDIDA') {
        tirar(pedido.id);
        avisar('Esse pedido já foi decidido.');
      } else avisar('Não deu para completar. Confira a conexão e tente de novo.');
    } finally {
      setEnviando(false);
      setDecisao(null);
    }
  }

  return (
    <div className="tela admin">
      <Topo titulo="Pedidos de troca" voltar />
      {lista === 'carregando' && <div aria-busy="true">{[0, 1, 2].map((n) => <div key={n} className="esqueleto" style={{ height: 120, marginBottom: 8 }} />)}</div>}
      {lista === 'erro' && (
        <div className="caixa-info" role="alert">
          <h2>Não deu para carregar os pedidos</h2>
          <Botao variante="secundario" onClick={carregar}>Tentar de novo</Botao>
        </div>
      )}
      {Array.isArray(lista) && lista.length === 0 && (
        <div className="caixa-info">
          <h2>Sem pedidos pendentes</h2>
          <p>Quando alguém pedir um clube, aparece aqui e você recebe um aviso.</p>
        </div>
      )}
      {Array.isArray(lista) && lista.length > 0 && (
        <ul role="list" className="pedidos">
          {lista.map((p) => (
            <li key={p.id} className="cartao-pedido">
              <div className="quem">
                <span className="av40" aria-hidden="true">{p.usuario.nome[0]?.toUpperCase()}</span>
                <div>
                  <strong>{p.usuario.nome}</strong>
                  <p>{p.tipo === 'SAIR' ? 'quer sair do clube' : <>quer assumir o <strong>{p.clubeDesejado?.nome}</strong></>}</p>
                  <p className="giz2 mini">{p.clubeAtual ? <>hoje é técnico do <strong>{p.clubeAtual.nome}</strong></> : 'hoje é torcedor'} · {haQuanto(p.criadoEm)}</p>
                </div>
              </div>
              {p.ocupado && (
                <div className="aviso" role="alert">
                  O {p.clubeDesejado?.nome} já tem técnico (clube ocupado). O pedido continua pendente: recuse ou espere o clube ficar livre.
                </div>
              )}
              <div className="duas-acoes">
                <Botao disabled={p.ocupado} onClick={() => setDecisao({ pedido: p, acao: 'aprovar' })}>Aprovar</Botao>
                <Botao variante="fantasma" onClick={() => setDecisao({ pedido: p, acao: 'recusar' })}>Recusar</Botao>
              </div>
            </li>
          ))}
        </ul>
      )}
      {decisao && (
        <Dialogo
          titulo={decisao.acao === 'aprovar' ? `Aprovar a troca de ${decisao.pedido.usuario.nome}?` : `Recusar o pedido de ${decisao.pedido.usuario.nome}?`}
          texto={decisao.acao === 'aprovar' ? textoAprovar(decisao.pedido) : `Ele continua ${decisao.pedido.clubeAtual ? 'no clube de hoje' : 'sem clube'} e recebe um aviso.`}
          acao={decisao.acao === 'aprovar' ? 'Aprovar' : 'Recusar'}
          ocupado={enviando}
          aoConfirmar={confirmar}
          aoVoltar={() => setDecisao(null)}
        />
      )}
      {toast && <div role="status" className="toast">{toast}</div>}
    </div>
  );
}
