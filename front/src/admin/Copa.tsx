import { useEffect, useState, type FormEvent } from 'react';
import { api, ErroApi } from '../api/cliente';
import { Aviso, Botao } from '../conta/ui';
import { Folha } from '../feed/Folha';
import { IcLixo, IcOk, Icone } from '../feed/icones';
import { diaHora } from '../liga/prazo';
import type { FaseCopa } from '../liga/Copa';
import { Link, navegar } from '../rotas';
import { Topo } from './Admin';

type Clube = { id: string; nome: string; escudoUrl: string };
type ConfrontoEd = { m: string; v: string; gm: string; gv: string; pm: string; pv: string };
const MAX_JOGOS = 10;
const paraCampoData = (iso?: string | null) => (iso ? new Date(new Date(iso).getTime() - new Date(iso).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '');
const deCampoData = (v: string) => (v ? new Date(v).toISOString() : null);
const num = (s: string) => (s === '' ? null : Number(s));
const placarOk = (s: string) => s === '' || /^\d{1,2}$/.test(s);

export function CopaFases() {
  const [fases, setFases] = useState<FaseCopa[] | 'carregando' | 'erro'>('carregando');
  const [nome, setNome] = useState('');
  const [ordem, setOrdem] = useState('');
  const [aviso, setAviso] = useState('');
  const [ocupado, setOcupado] = useState(false);
  function carregar() {
    setFases('carregando');
    api<FaseCopa[]>('/copa').then(setFases, () => setFases('erro'));
  }
  useEffect(carregar, []);

  async function criar(e: FormEvent) {
    e.preventDefault();
    setOcupado(true);
    setAviso('');
    try {
      await api('/admin/copa/fases', { method: 'POST', body: JSON.stringify({ nome: nome.trim(), ordem: Number(ordem) }) });
      setNome('');
      setOrdem('');
      carregar();
    } catch (er) {
      setAviso(er instanceof ErroApi && er.codigo === 'ORDEM_REPETIDA' ? 'Já existe uma fase com essa ordem. Escolha outro número.' : er instanceof ErroApi && er.codigo === 'DADOS_INVALIDOS' ? 'Dê um nome de até 60 letras e uma ordem de 1 a 99.' : 'Não deu para criar a fase. Tente de novo.');
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="tela admin copa-ed">
      <Topo titulo="Copa do Brasil" voltar />
      {fases === 'carregando' && <div aria-busy="true"><div className="esqueleto" style={{ marginBottom: 8 }} /><div className="esqueleto" /></div>}
      {fases === 'erro' && <div className="caixa-info" role="alert"><h2>Não deu para carregar as fases</h2><button type="button" className="botao secundario" onClick={carregar}>Tentar de novo</button></div>}
      {Array.isArray(fases) && (
        <nav className="linhas" aria-label="Fases da Copa">
          {fases.length === 0 && <p className="giz2">Nenhuma fase ainda. Crie a primeira abaixo.</p>}
          {fases.map(({ fase }) => (
            <Link key={fase.id} para={`/admin/copa/${fase.id}`} className="linha-config">
              <span className="rodada-nome">{fase.nome}</span>
              <span className="giz2">{fase.fechada ? (fase.resumoPublicado ? 'Fechada · resumo publicado' : 'Fechada · resumo pendente') : fase.prazoPalpite ? `Aberta · palpite até ${diaHora(fase.prazoPalpite)}` : 'Aberta · sem prazo'}</span>
              <span aria-hidden="true">›</span>
            </Link>
          ))}
        </nav>
      )}
      <form onSubmit={criar} className="nova-fase" noValidate>
        <h2>Nova fase</h2>
        <Aviso>{aviso}</Aviso>
        <label>Nome da fase<input value={nome} maxLength={60} onChange={(e) => setNome(e.target.value)} placeholder="Oitavas" /></label>
        <label>Ordem<input type="number" inputMode="numeric" min={1} max={99} value={ordem} onChange={(e) => setOrdem(e.target.value)} placeholder="1" /></label>
        <Botao type="submit" disabled={!nome.trim() || !/^\d{1,2}$/.test(ordem)} carregando={ocupado ? 'Criando…' : undefined}>Criar fase</Botao>
      </form>
    </div>
  );
}

function mensagemErro(e: unknown) {
  if (e instanceof ErroApi) {
    if (e.codigo === 'CLUBE_ELIMINADO') return 'Um desses clubes perdeu numa fase anterior (ou joga adiante) e não pode estar aqui. Confira os confrontos.';
    if (e.codigo === 'FASE_FECHADA') return 'Fase fechada: reabra para mudar os placares.';
    if (e.codigo === 'PLACAR_PENDENTE') return 'Faltam placares. Preencha todos os confrontos (e os pênaltis nos empates) para fechar a fase.';
    if (e.codigo === 'DADOS_INVALIDOS') return 'Confira os confrontos: um clube por fase, placar de 0 a 99 e, no empate, pênaltis que não empatam. Nada foi gravado.';
  }
  return 'Não deu para completar. Confira a conexão e tente de novo.';
}

export function CopaFase({ id }: { id: string }) {
  const [fase, setFase] = useState<FaseCopa | 'carregando' | 'erro' | null>('carregando');
  const [clubes, setClubes] = useState<Clube[]>([]);
  const [jogos, setJogos] = useState<ConfrontoEd[]>([]);
  const [prazo, setPrazo] = useState('');
  const [prazoIni, setPrazoIni] = useState('');
  const [aviso, setAviso] = useState('');
  const [ok, setOk] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [previa, setPrevia] = useState<{ texto: string; citados: string[] } | null>(null);
  const [texto, setTexto] = useState('');
  const [todas, setTodas] = useState<FaseCopa[]>([]);
  const [eliminados, setEliminados] = useState<{ indice: number; frase: string }[]>([]);

  function carregar() {
    setFase('carregando');
    Promise.all([api<FaseCopa[]>('/copa'), api<Clube[]>('/clubes')]).then(
      ([fs, cs]) => {
        const f = fs.find((x) => x.fase.id === id) ?? null;
        setTodas(fs);
        setClubes(cs.filter((c) => c.id !== 'cbf')); // a CBF não joga a Copa
        setFase(f);
        const campo = (n: number | null) => (n === null ? '' : String(n));
        setJogos(f?.jogos.map((j) => ({ m: j.mandante.id, v: j.visitante.id, gm: campo(j.golsMandante), gv: campo(j.golsVisitante), pm: campo(j.penaltisMandante), pv: campo(j.penaltisVisitante) })) ?? []);
        setPrazo(paraCampoData(f?.fase.prazoPalpite));
        setPrazoIni(paraCampoData(f?.fase.prazoPalpite));
      },
      () => setFase('erro'),
    );
  }
  useEffect(carregar, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const edita = (i: number, campo: keyof ConfrontoEd, valor: string) => setJogos((l) => l.map((j, k) => (k === i ? { ...j, [campo]: valor } : j)));
  const usados = (i: number) => new Set(jogos.flatMap((j, k) => (k === i ? [] : [j.m, j.v])).filter(Boolean));
  const empate = (j: ConfrontoEd) => j.gm !== '' && j.gm === j.gv;
  const semPlacar = (j: ConfrontoEd) => j.gm === '' && j.gv === '';
  const valido = (j: ConfrontoEd) =>
    !!j.m && !!j.v && j.m !== j.v && [j.gm, j.gv, j.pm, j.pv].every(placarOk) && (j.gm === '') === (j.gv === '') &&
    (empate(j) ? j.pm !== '' && j.pv !== '' && j.pm !== j.pv : j.pm === '' && j.pv === '');
  const salvavel = jogos.every((j) => (!semPlacar(j) || (j.pm === '' && j.pv === '')) && (semPlacar(j) ? !!j.m && !!j.v && j.m !== j.v : valido(j)));
  const completos = jogos.length > 0 && jogos.every((j) => !semPlacar(j) && valido(j));
  // a API só diz CLUBE_ELIMINADO; quem perdeu e onde sai das fases anteriores que a tela já carregou
  const achaEliminados = () => {
    const atual = todas.find((x) => x.fase.id === id)?.fase;
    const achados: { indice: number; frase: string }[] = [];
    jogos.forEach((j, indice) => {
      for (const cid of [j.m, j.v]) {
        const antes = todas.find(({ fase, jogos: js }) => atual && fase.ordem < atual.ordem && js.some((x) => x.vencedor && [x.mandante.id, x.visitante.id].includes(cid) && x.vencedor.id !== cid));
        if (antes && atual) achados.push({ indice, frase: `${nomeClube(cid)} perdeu em ${antes.fase.nome} e não pode jogar ${atual.nome}.` });
      }
    });
    return achados;
  };
  const nomeClube = (cid: string) => clubes.find((c) => c.id === cid)?.nome ?? cid;
  const corpo = () => JSON.stringify({ jogos: jogos.map((j) => ({ mandanteId: j.m, visitanteId: j.v, golsMandante: num(j.gm), golsVisitante: num(j.gv), penaltisMandante: empate(j) ? num(j.pm) : null, penaltisVisitante: empate(j) ? num(j.pv) : null })) });

  async function agir(f: () => Promise<void>) {
    setOcupado(true);
    setAviso('');
    setOk('');
    setEliminados([]);
    try {
      await f();
    } catch (e) {
      setAviso(mensagemErro(e));
      if (e instanceof ErroApi && e.codigo === 'CLUBE_ELIMINADO') setEliminados(achaEliminados());
    } finally {
      setOcupado(false);
    }
  }
  const gravar = async () => {
    await api(`/admin/copa/fases/${id}/jogos`, { method: 'PUT', body: corpo() });
    if (prazo !== prazoIni) await api(`/admin/copa/fases/${id}/prazo`, { method: 'PUT', body: JSON.stringify({ prazoPalpite: deCampoData(prazo) }) });
  };
  const salvar = () => agir(async () => { await gravar(); setOk('Fase salva.'); carregar(); });
  const fechar = () => {
    if (!completos) return setAviso('Preencha todos os placares (e os pênaltis nos empates) para fechar a fase.');
    return agir(async () => {
      await gravar();
      const p = await api<{ texto: string; citados: string[] }>(`/admin/copa/fases/${id}/fechar`, { method: 'POST' });
      setPrevia(p);
      setTexto(p.texto);
    });
  };
  const reabrir = () => agir(async () => { await api(`/admin/copa/fases/${id}/reabrir`, { method: 'POST' }); carregar(); });
  // fase já fechada e sem resumo: a API sorteia a prévia de novo
  const abrirPrevia = () => agir(async () => {
    const p = await api<{ texto: string; citados: string[] }>(`/admin/copa/fases/${id}/previa`, { method: 'POST' });
    setPrevia(p);
    setTexto(p.texto);
  });
  const publicar = () => agir(async () => {
    try {
      await api(`/admin/copa/fases/${id}/publicar`, { method: 'POST', body: JSON.stringify({ texto, citados: previa?.citados ?? [] }) });
    } catch (e) {
      if (!(e instanceof ErroApi && e.codigo === 'RESUMO_JA_PUBLICADO')) throw e; // já saiu: conta como feito, sem duplicar
    }
    setPrevia(null);
    navegar('/admin/copa');
  });

  const topo = <Topo titulo={fase && typeof fase === 'object' ? fase.fase.nome : 'Fase da Copa'} voltar />;
  const voltarLista = <Link para="/admin/copa" className="voltar-admin">‹ Copa do Brasil</Link>;
  if (fase === 'carregando') return <div className="tela admin">{topo}<div className="esqueleto" aria-busy="true" /></div>;
  if (fase === 'erro' || fase === null) return <div className="tela admin">{topo}<div className="caixa-info" role="alert"><h2>Não deu para carregar a fase</h2><button type="button" className="botao secundario" onClick={carregar}>Tentar de novo</button></div></div>;

  const folha = previa && (
    <Folha titulo="Resumo da CBF" aoFechar={() => { setPrevia(null); carregar(); }} alta>
      <div className="folha-form">
        <h2>Resumo da CBF</h2>
        <p className="giz2">A fase já está fechada. O resumo só sai quando você publicar.</p>
        <Aviso>{aviso}</Aviso>
        <textarea aria-label="Texto do resumo" rows={6} maxLength={500} value={texto} onChange={(e) => setTexto(e.target.value)} data-foco />
        <span className="giz2 legenda-s">{texto.length}/500 · O resumo só pode ser publicado uma vez por fase.</span>
        <Botao disabled={!texto.trim()} carregando={ocupado ? 'Publicando…' : undefined} onClick={publicar}>Publicar como CBF</Botao>
        <Botao variante="fantasma" onClick={() => { setPrevia(null); carregar(); }}>Cancelar</Botao>
      </div>
    </Folha>
  );

  if (fase.fase.fechada)
    return (
      <div className="tela admin copa-ed">
        {topo}{voltarLista}
        <Aviso>{aviso}</Aviso>
        {fase.fase.resumoPublicado ? (
          <p className="aviso-gramado"><IcOk /> Fase fechada. Resumo publicado pela CBF.{fase.fase.resumoPostId && <> <Link para={`/p/${fase.fase.resumoPostId}`}>Ver resumo</Link></>}</p>
        ) : (
          <p className="aviso-ambar">Fase fechada. O resumo da CBF ainda não foi publicado.</p>
        )}
        {!fase.fase.resumoPublicado && <Botao carregando={ocupado ? 'Abrindo…' : undefined} onClick={abrirPrevia}>Publicar resumo</Botao>}
        <ul className="confrontos-fechados">
          {jogos.map((j, i) => <li key={i}>{nomeClube(j.m)} {j.gm} × {j.gv} {nomeClube(j.v)}{j.pm !== '' && ` (pênaltis ${j.pm} × ${j.pv})`}</li>)}
        </ul>
        <Botao variante="fantasma" carregando={ocupado ? 'Reabrindo…' : undefined} onClick={reabrir}>Reabrir fase</Botao>
        <p className="giz2 legenda-s">Reabrir deixa mudar placares. Se mudar, os pontos do bolão são recalculados.</p>
        {folha}
      </div>
    );

  return (
    <div className="tela admin copa-ed">
      {topo}{voltarLista}
      <Aviso>{aviso}</Aviso>
      <label className="campo-prazo"><Icone nome="relogio" /><span>Prazo de palpite</span>
        <input type="datetime-local" value={prazo} disabled={ocupado} onChange={(e) => setPrazo(e.target.value)} />
      </label>
      <p className="giz2 legenda-s">Sem prazo ninguém palpita. Gols vazios deixam o confronto agendado.</p>
      <ul className="cartoes-jogo">
        {jogos.map((j, i) => {
          const fora = usados(i);
          const seletor = (lado: 'm' | 'v', rotulo: string) => (
            <select aria-label={`${rotulo} do confronto ${i + 1}`} value={j[lado]} disabled={ocupado} onChange={(e) => edita(i, lado, e.target.value)}>
              <option value="">Escolher clube</option>
              {clubes.map((c) => <option key={c.id} value={c.id} disabled={fora.has(c.id) || c.id === (lado === 'm' ? j.v : j.m)}>{c.nome}{fora.has(c.id) ? ' (já joga nesta fase)' : ''}</option>)}
            </select>
          );
          const campo = (k: 'gm' | 'gv' | 'pm' | 'pv', rotulo: string) => (
            <input type="number" inputMode="numeric" min={0} max={99} aria-label={rotulo} value={j[k]} disabled={ocupado} onChange={(e) => edita(i, k, e.target.value)} />
          );
          return (
            <li key={i} className={`cartao-jogo ${eliminados.some((x) => x.indice === i) ? 'pendente' : ''}`}>
              <div>{seletor('m', 'Mandante')}{campo('gm', `Gols do mandante, confronto ${i + 1}`)}</div>
              <div>{seletor('v', 'Visitante')}{campo('gv', `Gols do visitante, confronto ${i + 1}`)}</div>
              {empate(j) && (
                <div className="penaltis-ed">
                  <span>Pênaltis</span>{campo('pm', `Pênaltis do mandante, confronto ${i + 1}`)}{campo('pv', `Pênaltis do visitante, confronto ${i + 1}`)}
                  <span className="giz2 legenda-s">Quem passa não pode empatar.</span>
                </div>
              )}
              {eliminados.filter((x) => x.indice === i).map((x) => <p key={x.frase} className="erro-txt">{x.frase}</p>)}
              {(j.gm === '') !== (j.gv === '') && <p className="erro-txt">Preencha os dois lados ou deixe os dois vazios.</p>}
              <button type="button" className="remover-jogo" aria-label={`Remover confronto ${i + 1}`} onClick={() => setJogos((l) => l.filter((_, k) => k !== i))}><IcLixo /></button>
            </li>
          );
        })}
      </ul>
      {jogos.length < MAX_JOGOS && <Botao variante="secundario" disabled={ocupado} onClick={() => setJogos((l) => [...l, { m: '', v: '', gm: '', gv: '', pm: '', pv: '' }])}>Adicionar confronto</Botao>}
      <div role="status" className={ok ? 'toast' : 'sr'}>{ok}</div>
      <div className="acao-fixa">
        <Botao variante="secundario" disabled={!salvavel} carregando={ocupado ? 'Salvando…' : undefined} onClick={salvar}>Salvar fase</Botao>
        <Botao disabled={ocupado} onClick={fechar}>Fechar fase</Botao>
      </div>
      {folha}
    </div>
  );
}
