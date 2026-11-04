import { useEffect, useState } from 'react';
import { api, ErroApi } from '../api/cliente';
import { Aviso, Botao } from '../conta/ui';
import { Escudo } from '../feed/Escudo';
import { IcEditar, IcLixo, IcSortear } from '../feed/icones';
import type { Rodada } from '../liga/tipos';
import { Link, navegar } from '../rotas';
import { Topo } from './Admin';
import { Dialogo } from './Dialogo';

type Clube = { id: string; nome: string; escudoUrl: string };
type JogoEd = { m: string; v: string; gm: string; gv: string };
const MAX_JOGOS = 10;

export function RodadasLista() {
  const [lista, setLista] = useState<Rodada[] | 'carregando' | 'erro'>('carregando');
  function carregar() {
    setLista('carregando');
    api<Rodada[]>('/liga/rodadas').then(setLista, () => setLista('erro'));
  }
  useEffect(carregar, []);
  return (
    <div className="tela admin">
      <Topo titulo="Rodadas" voltar />
      {lista === 'carregando' && <div aria-busy="true">{Array.from({ length: 8 }, (_, i) => <div key={i} className="esqueleto" style={{ marginBottom: 8 }} />)}</div>}
      {lista === 'erro' && <div className="caixa-info" role="alert"><h2>Não deu para carregar as rodadas</h2><button type="button" className="botao secundario" onClick={carregar}>Tentar de novo</button></div>}
      {Array.isArray(lista) && (
        <nav className="linhas" aria-label="Rodadas">
          {lista.map((r) => {
            const estado = r.fechada ? 'Fechada' : r.jogos.length ? 'Aberta' : 'Sem jogos';
            return (
              <Link key={r.numero} para={`/admin/rodadas/${r.numero}`} className="linha-config">
                <span className="rodada-nome">Rodada {r.numero}</span>
                <span className="giz2">{r.jogos.length} {r.jogos.length === 1 ? 'jogo' : 'jogos'}</span>
                <span className={`etiqueta ${r.fechada ? 'fechada' : r.jogos.length ? 'aberta' : ''}`}>{estado}</span>
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}

const mensagemErro = (e: unknown) => {
  if (e instanceof ErroApi) {
    if (e.codigo === 'RODADA_FECHADA') return 'Essa rodada foi fechada. Reabra para editar.';
    if (e.codigo === 'DADOS_INVALIDOS') return 'Confira os jogos: cada clube joga uma vez por rodada, sem jogo repetido, e o placar vai de 0 a 99. Nada foi gravado: corrija e salve de novo.';
  }
  return 'Não deu para completar. Confira a conexão e tente de novo.';
};

export function RodadaEditar({ n }: { n: number }) {
  const [rodada, setRodada] = useState<Rodada | 'carregando' | 'erro' | null>('carregando');
  const [clubes, setClubes] = useState<Clube[]>([]);
  const [jogos, setJogos] = useState<JogoEd[]>([]);
  const [aviso, setAviso] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [reabrir, setReabrir] = useState(false);
  const [previa, setPrevia] = useState<{ texto: string; citados: string[] } | null>(null);

  function carregar() {
    setRodada('carregando');
    Promise.all([api<Rodada[]>('/liga/rodadas'), api<Clube[]>('/clubes')]).then(
      ([rs, cs]) => {
        const r = rs.find((x) => x.numero === n) ?? null;
        setClubes(cs);
        setRodada(r);
        setJogos(r?.jogos.map((j) => ({ m: j.mandante.id, v: j.visitante.id, gm: String(j.golsMandante), gv: String(j.golsVisitante) })) ?? []);
      },
      () => setRodada('erro'),
    );
  }
  useEffect(carregar, [n]);

  const usados = (i: number) => new Set(jogos.flatMap((j, k) => (k === i ? [] : [j.m, j.v])).filter(Boolean));
  const placarOk = (s: string) => /^\d{1,2}$/.test(s);
  const completos = jogos.length > 0 && jogos.every((j) => j.m && j.v && j.m !== j.v && placarOk(j.gm) && placarOk(j.gv));
  const edita = (i: number, campo: keyof JogoEd, valor: string) => setJogos((l) => l.map((j, k) => (k === i ? { ...j, [campo]: valor } : j)));
  const corpo = () => JSON.stringify({ jogos: jogos.map((j) => ({ mandanteId: j.m, visitanteId: j.v, golsMandante: Number(j.gm), golsVisitante: Number(j.gv) })) });

  async function agir(f: () => Promise<void>) {
    setOcupado(true);
    setAviso('');
    try {
      await f();
    } catch (e) {
      setAviso(mensagemErro(e));
    } finally {
      setOcupado(false);
    }
  }
  const salvar = () => agir(async () => {
    await api(`/admin/rodadas/${n}/jogos`, { method: 'PUT', body: corpo() });
    setAviso('');
    carregar();
  });
  // fechar: grava os jogos, fecha e já mostra a prévia do post da CBF (a API só sorteia a frase com a rodada fechada)
  const fechar = () => {
    if (!jogos.length) return setAviso('Lance ao menos um jogo');
    if (!completos) return setAviso('Escolha os dois clubes e o placar (0 a 99) de cada jogo.');
    return agir(async () => {
      await api(`/admin/rodadas/${n}/jogos`, { method: 'PUT', body: corpo() });
      await api(`/admin/rodadas/${n}/fechar`, { method: 'POST' });
      setPrevia(await api(`/admin/rodadas/${n}/previa`, { method: 'POST' }));
    });
  };
  const reabrirConfirmado = () => agir(async () => {
    await api(`/admin/rodadas/${n}/reabrir`, { method: 'POST' });
    setReabrir(false);
    carregar();
  });

  if (previa) return <Previa n={n} inicial={previa} />;
  if (rodada === 'carregando') return <div className="tela admin"><Topo titulo={`Rodada ${n}`} voltar /><div className="esqueleto" aria-busy="true" /></div>;
  if (rodada === 'erro' || rodada === null) return <div className="tela admin"><Topo titulo={`Rodada ${n}`} voltar /><div className="caixa-info" role="alert"><h2>Não deu para carregar a rodada</h2><button type="button" className="botao secundario" onClick={carregar}>Tentar de novo</button></div></div>;

  if (rodada.fechada)
    return (
      <div className="tela admin">
        <Topo titulo={`Rodada ${n}`} voltar />
        <p className="aviso-gramado">Rodada fechada. O post da CBF já saiu e a tabela já conta esses jogos.</p>
        <Aviso>{aviso}</Aviso>
        <ul className="jogos">
          {rodada.jogos.map((j) => <li key={j.id}><span className="time mandante">{j.mandante.nome}</span><Escudo src={j.mandante.escudoUrl} tam={22} /><strong className="placar">{j.golsMandante} × {j.golsVisitante}</strong><Escudo src={j.visitante.escudoUrl} tam={22} /><span className="time">{j.visitante.nome}</span></li>)}
        </ul>
        <Botao variante="secundario" onClick={() => setReabrir(true)}>Reabrir para editar</Botao>
        {reabrir && <Dialogo titulo={`Reabrir a rodada ${n}?`} texto="A tabela é recalculada sem esses jogos até você fechar de novo. O post da CBF que já saiu não muda." acao="Reabrir rodada" voltarRotulo="Cancelar" ocupado={ocupado} aoConfirmar={reabrirConfirmado} aoVoltar={() => setReabrir(false)} />}
      </div>
    );

  return (
    <div className="tela admin">
      <Topo titulo={`Rodada ${n}`} voltar />
      <Aviso>{aviso}</Aviso>
      <ul className="cartoes-jogo">
        {jogos.map((j, i) => {
          const fora = usados(i);
          const seletor = (lado: 'm' | 'v', rotulo: string) => (
            <select aria-label={`${rotulo} do jogo ${i + 1}`} value={j[lado]} disabled={ocupado} onChange={(e) => edita(i, lado, e.target.value)}>
              <option value="">Escolher clube</option>
              {clubes.map((c) => {
                const outro = lado === 'm' ? j.v : j.m;
                const bloqueado = fora.has(c.id) || c.id === outro;
                return <option key={c.id} value={c.id} disabled={bloqueado}>{c.nome}{fora.has(c.id) ? ' (já joga nesta rodada)' : ''}</option>;
              })}
            </select>
          );
          const placar = (lado: 'gm' | 'gv', rotulo: string) => (
            <input type="number" inputMode="numeric" min={0} max={99} aria-label={rotulo} value={j[lado]} disabled={ocupado} onChange={(e) => edita(i, lado, e.target.value)} />
          );
          return (
            <li key={i} className="cartao-jogo">
              <div>{seletor('m', 'Mandante')}{placar('gm', `Gols do mandante, jogo ${i + 1}`)}</div>
              <div>{seletor('v', 'Visitante')}{placar('gv', `Gols do visitante, jogo ${i + 1}`)}</div>
              {(!placarOk(j.gm) && j.gm !== '' || !placarOk(j.gv) && j.gv !== '') && <p className="erro-txt">Placar de 0 a 99</p>}
              <button type="button" className="remover-jogo" aria-label={`Remover jogo ${i + 1}`} onClick={() => setJogos((l) => l.filter((_, k) => k !== i))}><IcLixo /></button>
            </li>
          );
        })}
      </ul>
      {jogos.length < MAX_JOGOS && <Botao variante="secundario" disabled={ocupado} onClick={() => setJogos((l) => [...l, { m: '', v: '', gm: '0', gv: '0' }])}>Adicionar jogo</Botao>}
      <div className="acao-fixa">
        <Botao variante="secundario" disabled={!completos && jogos.length > 0} carregando={ocupado ? 'Salvando…' : undefined} onClick={salvar}>Salvar jogos</Botao>
        <Botao disabled={ocupado} onClick={fechar}>Fechar rodada</Botao>
      </div>
    </div>
  );
}

// prévia do post da CBF: sortear de novo, editar (até 500) e publicar; a rodada já está fechada
function Previa({ n, inicial }: { n: number; inicial: { texto: string; citados: string[] } }) {
  const [sorteado, setSorteado] = useState(inicial);
  const [texto, setTexto] = useState(inicial.texto);
  const [editando, setEditando] = useState(false);
  const [descartar, setDescartar] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState('');
  const editado = texto !== sorteado.texto;

  async function sortear() {
    setDescartar(false);
    setAviso('');
    try {
      const novo = await api<{ texto: string; citados: string[] }>(`/admin/rodadas/${n}/previa`, { method: 'POST' });
      setSorteado(novo);
      setTexto(novo.texto);
      setEditando(false);
    } catch {
      setAviso('Não deu para sortear. Tente de novo.');
    }
  }
  async function publicar() {
    setOcupado(true);
    setAviso('');
    try {
      await api(`/admin/rodadas/${n}/publicar`, { method: 'POST', body: JSON.stringify({ texto, citados: sorteado.citados }) });
      navegar('/admin/rodadas');
    } catch {
      setAviso('Não deu para publicar. Tente de novo.');
      setOcupado(false);
    }
  }
  return (
    <div className="tela admin previa-bot">
      <button type="button" className="link" aria-label="Fechar prévia" onClick={() => navegar('/admin/rodadas')}>✕</button>
      <h1>Prévia do post da CBF</h1>
      <p className="giz2">Rodada {n} fechada. O post só sai quando você publicar.</p>
      <Aviso>{aviso}</Aviso>
      <div className="comunicado">
        <span className="rotulo-comunicado">COMUNICADO · RODADA {n}</span>
        {editando ? (
          <>
            <textarea aria-label="Texto do post" rows={6} value={texto} maxLength={500} onChange={(e) => setTexto(e.target.value)} autoFocus />
            <span className="giz2 legenda-s">{texto.length}/500</span>
            <span className="giz2 legenda-s">O texto editado vai como está. Menções com @ avisam a pessoa.</span>
          </>
        ) : (
          <p className="texto-bot">{texto}</p>
        )}
      </div>
      {sorteado.citados.length > 0 && <p className="giz2 legenda-s">{sorteado.citados.length} {sorteado.citados.length === 1 ? 'técnico recebe' : 'técnicos recebem'} aviso por ser citado.</p>}
      <div className="duas-acoes">
        <button type="button" className="botao secundario" onClick={() => (editado ? setDescartar(true) : sortear())}><IcSortear /> Sortear de novo</button>
        {editando
          ? <button type="button" className="botao secundario" onClick={() => { setTexto(sorteado.texto); setEditando(false); }}>Voltar à frase sorteada</button>
          : <button type="button" className="botao secundario" onClick={() => setEditando(true)}><IcEditar /> Editar texto</button>}
      </div>
      <div className="acao-fixa">
        <Botao disabled={!texto.trim()} carregando={ocupado ? 'Publicando…' : undefined} onClick={publicar}>Fechar e publicar</Botao>
        <button type="button" className="link giz2" disabled={ocupado} onClick={() => navegar('/admin/rodadas')}>Fechar sem postar</button>
      </div>
      {descartar && <Dialogo titulo="Descartar o texto editado?" texto="Sortear de novo troca a frase e perde a sua edição." acao="Sortear de novo" voltarRotulo="Cancelar" aoConfirmar={sortear} aoVoltar={() => setDescartar(false)} />}
    </div>
  );
}
