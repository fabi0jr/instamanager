import { useEffect, useState, type FormEvent } from 'react';
import { api, ErroApi } from '../api/cliente';
import { Aviso, Botao } from '../conta/ui';
import { Link, navegar } from '../rotas';
import { prazoTexto, vencedores, type Votacao } from '../votacoes/tipos';
import { Topo } from './Admin';
import { Dialogo } from './Dialogo';

type ClubeAdm = { id: string; nome: string; tecnico: { id: string; nome: string } | null };
const TIPOS = [['CLUBE', 'Clube'], ['TECNICO', 'Técnico'], ['POST', 'Post']] as const;

export function VotacoesAdmin() {
  const [lista, setLista] = useState<Votacao[] | 'carregando' | 'erro'>('carregando');
  const [encerrar, setEncerrar] = useState<Votacao | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState('');
  const [encerradas, setEncerradas] = useState<Votacao[]>([]);
  function carregar() {
    setLista('carregando');
    api<Votacao[]>('/votacoes').then(setLista, () => setLista('erro'));
    api<Votacao[]>('/votacoes?encerradas=1').then((l) => setEncerradas(Array.isArray(l) ? l : []), () => setEncerradas([]));
  }
  useEffect(carregar, []);
  async function confirmar() {
    if (!encerrar) return;
    setOcupado(true);
    try {
      const v = await api<Votacao>(`/admin/votacoes/${encerrar.id}/encerrar`, { method: 'POST' });
      const g = v.resultado ? vencedores(v.resultado) : [];
      setAviso(g.length ? `Votação encerrada. Selo criado para ${g.map((x) => x.rotulo).join(' e ')}.` : 'Votação encerrada. Ninguém votou, então não houve selo.');
      setLista((l) => (Array.isArray(l) ? l.filter((x) => x.id !== v.id) : l));
      setEncerradas((l) => [{ ...v, vencedor: g.map((x) => x.rotulo).join(' e ') || null }, ...l]);
    } catch {
      setAviso('Não deu para encerrar. Confira a conexão e tente de novo.');
    } finally {
      setOcupado(false);
      setEncerrar(null);
    }
  }
  return (
    <div className="tela admin">
      <Topo titulo="Votações" voltar />
      <Link para="/admin/votacoes/nova" className="botao">Nova votação</Link>
      {aviso && <p role="status" className="aviso-gramado">{aviso}</p>}
      {lista === 'carregando' && <div className="esqueleto" aria-busy="true" />}
      {lista === 'erro' && <div className="caixa-info" role="alert"><h2>Não deu para carregar as votações</h2><button type="button" className="botao secundario" onClick={carregar}>Tentar de novo</button></div>}
      {Array.isArray(lista) && lista.length === 0 && <p className="giz2">Nenhuma votação em aberto.</p>}
      {Array.isArray(lista) && (
        <ul className="pedidos">
          {lista.map((v) => (
            <li key={v.id} className="cartao-pedido">
              <strong>{v.titulo}</strong>
              <span className="giz2">{v.aberta ? prazoTexto(v.prazo) : 'Prazo acabou, falta encerrar'} · {v.opcoes.length} concorrentes</span>
              <button type="button" className="botao secundario" onClick={() => setEncerrar(v)}>Encerrar</button>
            </li>
          ))}
        </ul>
      )}
      {encerradas.length > 0 && (
        <>
          <p className="giz2 legenda-s">ENCERRADAS</p>
          <ul className="pedidos">
            {encerradas.map((v) => (
              <li key={v.id} className="cartao-pedido">
                <strong>{v.titulo}</strong>
                <span className="giz2">Encerrada · {v.vencedor ? `Venceu: ${v.vencedor}` : 'Sem votos'}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      {encerrar && <Dialogo titulo={`Encerrar “${encerrar.titulo}”?`} texto="A CBF posta o resultado e o vencedor ganha o selo no perfil do clube. Não dá para desfazer." acao="Encerrar agora" voltarRotulo="Cancelar" ocupado={ocupado} aoConfirmar={confirmar} aoVoltar={() => setEncerrar(null)} />}
    </div>
  );
}

const idDoLink = (s: string) => s.trim().match(/\/p\/([^/?#\s]+)/)?.[1] ?? s.trim();

export function NovaVotacao() {
  const [titulo, setTitulo] = useState('');
  const [tipo, setTipo] = useState<'CLUBE' | 'TECNICO' | 'POST'>('CLUBE');
  const [clubes, setClubes] = useState<ClubeAdm[]>([]);
  const [opcoes, setOpcoes] = useState<{ id: string; rotulo: string }[]>([]);
  const [link, setLink] = useState('');
  const [prazo, setPrazo] = useState('');
  const [aviso, setAviso] = useState('');
  const [ocupado, setOcupado] = useState(false);
  useEffect(() => { api<ClubeAdm[]>('/clubes').then(setClubes, () => setAviso('Não deu para carregar os clubes.')); }, []);
  // clube/técnico: começa com todos (chips removíveis); post: o admin cola os links
  useEffect(() => {
    if (tipo === 'CLUBE') setOpcoes(clubes.map((c) => ({ id: c.id, rotulo: c.nome })));
    else if (tipo === 'TECNICO') setOpcoes(clubes.filter((c) => c.tecnico).map((c) => ({ id: c.tecnico!.id, rotulo: `${c.tecnico!.nome} (${c.nome})` })));
    else setOpcoes([]);
  }, [tipo, clubes]);

  const futuro = prazo !== '' && new Date(prazo).getTime() > Date.now();
  const ok = titulo.trim().length > 0 && titulo.length <= 100 && opcoes.length >= 2 && opcoes.length <= 10 && futuro;
  function adicionarPost() {
    const id = idDoLink(link);
    if (id && !opcoes.some((o) => o.id === id)) setOpcoes((l) => [...l, { id, rotulo: `Post ${id.slice(0, 8)}` }]);
    setLink('');
  }
  async function criar(e: FormEvent) {
    e.preventDefault();
    setOcupado(true);
    setAviso('');
    try {
      await api('/admin/votacoes', { method: 'POST', body: JSON.stringify({ titulo: titulo.trim(), tipo, opcoes: opcoes.map((o) => o.id), prazo: new Date(prazo).toISOString() }) });
      navegar('/admin/votacoes');
    } catch (err) {
      setAviso(err instanceof ErroApi && err.codigo === 'DADOS_INVALIDOS' ? 'Confira o título, de 2 a 10 concorrentes e o prazo (no futuro).' : 'Não deu para criar. Confira a conexão e tente de novo.');
      setOcupado(false);
    }
  }
  return (
    <form className="tela admin form-folha" onSubmit={criar} noValidate>
      <Topo titulo="Nova votação" voltar />
      <Aviso>{aviso}</Aviso>
      <label htmlFor="vt-titulo">Título</label>
      <input id="vt-titulo" value={titulo} maxLength={100} onChange={(e) => setTitulo(e.target.value)} />
      <div role="radiogroup" aria-label="O que vai ser votado" className="alternancia">
        {TIPOS.map(([t, n]) => <button key={t} type="button" role="radio" aria-checked={tipo === t} onClick={() => setTipo(t)}>{n}</button>)}
      </div>
      <p className="giz2 legenda-s">Concorrentes ({opcoes.length} de 2 a 10)</p>
      <ul className="chips-opcoes">
        {opcoes.map((o) => <li key={o.id}>{o.rotulo} <button type="button" aria-label={`Remover ${o.rotulo}`} onClick={() => setOpcoes((l) => l.filter((x) => x.id !== o.id))}>✕</button></li>)}
      </ul>
      {tipo === 'POST' && (
        <div>
          <label htmlFor="vt-link">Link do post (/p/…)</label>
          <input id="vt-link" value={link} onChange={(e) => setLink(e.target.value)} />
          <button type="button" className="botao secundario" disabled={!link.trim()} onClick={adicionarPost}>Adicionar post</button>
        </div>
      )}
      <label htmlFor="vt-prazo">Prazo</label>
      <input id="vt-prazo" type="datetime-local" value={prazo} onChange={(e) => setPrazo(e.target.value)} />
      <div className="acao-fixa"><Botao type="submit" disabled={!ok} carregando={ocupado ? 'Criando…' : undefined}>Criar votação</Botao></div>
    </form>
  );
}
