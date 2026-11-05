import { useEffect, useState } from 'react';
import { api } from '../api/cliente';
import { Icone } from '../feed/icones';
import { haQuanto } from '../feed/tipos';
import { Topo } from './Admin';

type Acao = { id: string; ferramenta: string; resumo: string; ok: boolean; erro: string | null; criadaEm: string };

// /admin/mcp: as 100 ações mais novas da CBF via MCP (shortcut: sem rolagem infinita, o back não pagina; só lista, tocar não abre nada)
export function Mcp() {
  const [lista, setLista] = useState<Acao[] | 'carregando' | 'erro'>('carregando');
  const carregar = () => { setLista('carregando'); api<Acao[]>('/admin/mcp').then(setLista, () => setLista('erro')); };
  useEffect(carregar, []);
  return (
    <div className="tela admin">
      <Topo titulo="Ações da CBF via MCP" voltar />
      {lista === 'carregando' && <div role="status" aria-label="Carregando" style={{ display: 'grid', gap: 8 }}>{[1, 2, 3, 4, 5].map((n) => <div key={n} className="esqueleto" style={{ height: 72, borderRadius: 12 }} />)}</div>}
      {lista === 'erro' && (
        <div className="caixa-info caixa-erro-video" role="alert">
          <h2>Não deu para carregar o log</h2>
          <button type="button" className="botao" onClick={carregar}>Tentar de novo</button>
        </div>
      )}
      {Array.isArray(lista) && lista.length === 0 && (
        <div className="caixa-info">
          <Icone nome="chave" />
          <h2>Nenhuma ação da CBF via MCP ainda.</h2>
          <p className="giz2 legenda-s">Quando o Claude agir pela chave da CBF, aparece aqui.</p>
        </div>
      )}
      {Array.isArray(lista) && lista.length > 0 && (
        <ul className="log-mcp">
          {lista.map((a) => (
            <li key={a.id}>
              <div className="l1">
                <code>{a.ferramenta}</code>
                {/* sem ícone de alerta no conjunto: o X (fechar) + a palavra "erro" marcam a falha */}
                <span className={a.ok ? 'selo-ok' : 'selo-erro'}><Icone nome={a.ok ? 'ok' : 'fechar'} />{a.ok ? 'ok' : 'erro'}</span>
              </div>
              <span className="entrada giz2 legenda-s">{a.resumo}</span>
              {!a.ok && a.erro && <span className="msg-erro">{a.erro}</span>}
              <span className="giz3 legenda-s">{haQuanto(a.criadaEm)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
