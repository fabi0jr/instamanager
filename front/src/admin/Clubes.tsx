import { useEffect, useState } from 'react';
import { api } from '../api/cliente';
import { Botao } from '../conta/ui';
import { Escudo } from '../feed/Escudo';
import { Topo } from './Admin';
import { Dialogo } from './Dialogo';

type ClubeAdm = { id: string; nome: string; escudoUrl: string; tecnico: { id: string; nome: string } | null };

export function Clubes() {
  const [lista, setLista] = useState<ClubeAdm[] | 'carregando' | 'erro'>('carregando');
  const [tirar, setTirar] = useState<ClubeAdm | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [toast, setToast] = useState('');

  function carregar() {
    setLista('carregando');
    api<ClubeAdm[]>('/clubes').then(setLista, () => setLista('erro'));
  }
  useEffect(carregar, []);

  async function confirmar() {
    if (!tirar?.tecnico) return;
    const { id, nome, tecnico } = tirar;
    setEnviando(true);
    try {
      await api(`/admin/clubes/${id}/remover-tecnico`, { method: 'POST' });
      setLista((l) => (Array.isArray(l) ? l.map((c) => (c.id === id ? { ...c, tecnico: null } : c)) : l));
      setToast(`${tecnico.nome} saiu do ${nome}.`);
    } catch {
      setToast('Não deu para completar. Confira a conexão e tente de novo.');
    } finally {
      setTimeout(() => setToast(''), 4000);
      setEnviando(false);
      setTirar(null);
    }
  }

  return (
    <div className="tela admin">
      <Topo titulo="Clubes e técnicos" voltar />
      {lista === 'carregando' && <div aria-busy="true">{[0, 1, 2, 3, 4].map((n) => <div key={n} className="esqueleto" style={{ marginBottom: 8 }} />)}</div>}
      {lista === 'erro' && (
        <div className="caixa-info" role="alert">
          <h2>Não deu para carregar os clubes</h2>
          <Botao variante="secundario" onClick={carregar}>Tentar de novo</Botao>
        </div>
      )}
      {Array.isArray(lista) && (
        <ul role="list" className="clubes-adm">
          {lista.map((c) => (
            <li key={c.id}>
              {c.tecnico ? (
                <button type="button" className="linha-clube" onClick={() => setTirar(c)}>
                  <Escudo src={c.escudoUrl} tam={44} />
                  <span className="nome">{c.nome}</span>
                  <span className="giz2">Técnico: {c.tecnico.nome} <span aria-hidden="true">›</span></span>
                </button>
              ) : (
                <div className="linha-clube">
                  <Escudo src={c.escudoUrl} tam={44} />
                  <span className="nome">{c.nome}</span>
                  <span className="pilula">Vaga aberta</span>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {tirar?.tecnico && (
        <Dialogo
          titulo={`Tirar ${tirar.tecnico.nome} do ${tirar.nome}?`}
          texto="Ele vira torcedor, o clube fica com vaga aberta e os posts continuam no clube. O histórico mostra a data de saída."
          acao="Tirar técnico"
          perigo
          ocupado={enviando}
          aoConfirmar={confirmar}
          aoVoltar={() => setTirar(null)}
        />
      )}
      {toast && <div role="status" className="toast">{toast}</div>}
    </div>
  );
}
