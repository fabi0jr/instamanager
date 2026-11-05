import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Alerta } from '../conta/ui';
import { api, ErroApi, type ClubeMini, type Me } from '../api/cliente';
import { Escudo } from '../feed/Escudo';
import { IcOk, Icone } from '../feed/icones';
import { sigla } from '../feed/siglas';
import { Link, navegar } from '../rotas';
import type { FaseCopa } from './Copa';
import { diaHora, emMenosDe24h, faltam } from './prazo';
import type { Rodada } from './tipos';

type Alvo = {
  chave: string; rotulo: string; prazo: string | null; copa: boolean; query: string;
  jogos: { id: string; mandante: ClubeMini; visitante: ClubeMini; semPlacar: boolean }[];
};
type Meu = { jogoId: string | null; copaJogoId: string | null; golsMandante: number; golsVisitante: number; classificadoId: string | null; pontos: number | null; exato: boolean };
type Rascunho = { gm: number | null; gv: number | null; cl: string | null };

// um chip por rodada ou fase com palpite aberto (docs/design/pack3-onda-a.md §4): prazo futuro mais próximo primeiro, depois sem prazo, depois os já travados
export function montarAlvos(rodadas: Rodada[], fases: FaseCopa[], agora = Date.now()): Alvo[] {
  const alvos: Alvo[] = [
    ...rodadas.filter((r) => !r.fechada && r.jogos.length).map((r): Alvo => ({
      chave: `r${r.numero}`, rotulo: `Rodada ${r.numero}`, prazo: r.prazoPalpite ?? null, copa: false, query: `rodada=${r.numero}`,
      jogos: r.jogos.map((j) => ({ id: j.id, mandante: j.mandante, visitante: j.visitante, semPlacar: j.golsMandante === null || j.golsVisitante === null })),
    })),
    ...fases.filter(({ fase, jogos }) => !fase.fechada && jogos.length).map(({ fase, jogos }): Alvo => ({
      chave: `f${fase.id}`, rotulo: `Copa · ${fase.nome}`, prazo: fase.prazoPalpite, copa: true, query: `fase=${fase.id}`,
      jogos: jogos.map((j) => ({ id: j.id, mandante: j.mandante, visitante: j.visitante, semPlacar: j.golsMandante === null || j.golsVisitante === null })),
    })),
  ];
  const faixa = (a: Alvo) => (!a.prazo ? 1 : new Date(a.prazo).getTime() > agora ? 0 : 2);
  const t = (a: Alvo) => (a.prazo ? new Date(a.prazo).getTime() : 0);
  return alvos.sort((a, b) => faixa(a) - faixa(b) || (faixa(a) === 2 ? t(b) - t(a) : t(a) - t(b)));
}

function Faixa({ prazo, agora, encerradoPorErro }: { prazo: string | null; agora: number; encerradoPorErro: boolean }) {
  if (encerradoPorErro) return <p className="faixa-prazo erro" role="alert"><Alerta tam={24} />O prazo acabou. Nenhum palpite foi salvo.</p>;
  if (!prazo) return <p className="faixa-prazo" role="status"><Icone nome="cadeado" />O admin ainda não definiu o prazo. Dá para palpitar quando ele definir.</p>;
  const resta = faltam(prazo, agora);
  if (!resta) return <p className="faixa-prazo" role="status"><Icone nome="cadeado" />Prazo encerrado em {diaHora(prazo)}. Seus palpites estão travados.</p>;
  return <p className={`faixa-prazo ${emMenosDe24h(prazo, agora) ? 'correndo' : ''}`} role="status"><Icone nome="relogio" />Palpite até {diaHora(prazo)}. {resta}</p>;
}

function Placar({ nome, valor, travado, aoMudar }: { nome: string; valor: number | null; travado: boolean; aoMudar: (v: number) => void }) {
  if (travado) return <span className="placar-palpite travado" aria-label={`Palpite do ${nome}: ${valor ?? 'sem palpite'}`}>{valor ?? '–'}</span>;
  const tecla = (e: KeyboardEvent) => {
    if (e.key === 'ArrowUp') { e.preventDefault(); aoMudar(Math.min(99, (valor ?? -1) + 1)); }
    if (e.key === 'ArrowDown') { e.preventDefault(); aoMudar(Math.max(0, (valor ?? 1) - 1)); }
  };
  return (
    <span className="placar-palpite">
      <button type="button" className="passo" aria-label={`Menos um gol para o ${nome}`} disabled={!valor} onClick={() => aoMudar((valor ?? 1) - 1)}><span className="traco" /></button>
      <span role="spinbutton" tabIndex={0} className={`numero ${valor === null ? 'vazio' : ''}`} aria-label={`Gols do ${nome}${valor === null ? '' : `, ${valor}`}`} aria-valuemin={0} aria-valuemax={99} aria-valuenow={valor ?? undefined} onKeyDown={tecla}>{valor ?? '–'}</span>
      <button type="button" className="passo" aria-label={`Mais um gol para o ${nome}`} disabled={valor === 99} onClick={() => aoMudar((valor ?? -1) + 1)}><span className="traco" /><span className="traco v" /></button>
    </span>
  );
}

export function Palpitar({ inicial }: { inicial: { rodada?: string | null; fase?: string | null } }) {
  const [alvos, setAlvos] = useState<Alvo[] | 'carregando' | 'erro'>('carregando');
  const [escolhido, setEscolhido] = useState<string | null>(inicial.rodada ? `r${inicial.rodada}` : inicial.fase ? `f${inicial.fase}` : null);
  const [rasc, setRasc] = useState<Record<string, Rascunho>>({});
  const [salvos, setSalvos] = useState<Record<string, Meu>>({});
  const [carregandoMeus, setCarregandoMeus] = useState(true); // esqueleto até o GET /bolao/meus responder
  const pedido = useRef(0); // resposta de um chip antigo (troca rápida) é ignorada
  const editou = useRef(false); // a pessoa mexeu depois do pedido: a resposta não sobrescreve o rascunho
  const [sujo, setSujo] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState('');
  const [aviso409, setAviso409] = useState(false);
  const [ok, setOk] = useState('');
  const [agora, setAgora] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  function carregar() {
    setAlvos('carregando');
    Promise.all([api<Rodada[]>('/liga/rodadas'), api<FaseCopa[]>('/copa')]).then(([r, f]) => setAlvos(montarAlvos(r, Array.isArray(f) ? f : [])), () => setAlvos('erro'));
  }
  useEffect(carregar, []);
  const alvo = Array.isArray(alvos) ? (alvos.find((a) => a.chave === escolhido) ?? alvos[0]) : undefined;

  const carregarMeus = useCallback((a: Alvo) => {
    setCarregandoMeus(true);
    editou.current = false;
    const meu = ++pedido.current;
    setSujo(false);
    setAviso409(false);
    api<Meu[]>(`/bolao/meus?${a.query}`).then(
      (lista) => {
        if (meu !== pedido.current) return;
        const porJogo: Record<string, Meu> = {};
        const r: Record<string, Rascunho> = {};
        for (const m of lista) {
          const id = (m.jogoId ?? m.copaJogoId)!;
          porJogo[id] = m;
          r[id] = { gm: m.golsMandante, gv: m.golsVisitante, cl: m.classificadoId };
        }
        setSalvos(porJogo);
        if (!editou.current) setRasc(r);
        setCarregandoMeus(false);
      },
      () => { if (meu !== pedido.current) return; setAviso('Não deu para carregar seus palpites. Tente de novo.'); setCarregandoMeus(false); },
    );
  }, []);
  useEffect(() => { if (alvo) { setAviso(''); setOk(''); carregarMeus(alvo); } }, [alvo?.chave]); // eslint-disable-line react-hooks/exhaustive-deps

  if (alvos === 'carregando') return <div aria-busy="true"><div className="esqueleto" style={{ height: 52 }} />{[0, 1, 2].map((i) => <div key={i} className="esqueleto" style={{ height: 116, marginTop: 8 }} />)}</div>;
  if (alvos === 'erro') return <div className="caixa-info" role="alert"><h2>Não deu para carregar o bolão</h2><button type="button" className="botao secundario" onClick={carregar}>Tentar de novo</button></div>;
  if (!alvo) return <div className="caixa-info"><Icone nome="bola" /><h2>Nenhum palpite aberto</h2><p className="giz2">Quando o admin lançar a próxima rodada ou uma fase da Copa, os jogos aparecem aqui.</p></div>;

  const travadoPorPrazo = !alvo.prazo || new Date(alvo.prazo).getTime() <= agora;
  const travado = travadoPorPrazo || aviso409;
  const pode = (j: Alvo['jogos'][number]) => !travado && j.semPlacar;
  const ver = (id: string): Rascunho => rasc[id] ?? { gm: null, gv: null, cl: null };
  const muda = (id: string, parte: Partial<Rascunho>) => { editou.current = true; setRasc((r) => ({ ...r, [id]: { ...ver(id), ...parte } })); setSujo(true); setOk(''); };
  const preenchido = (r: Rascunho) => r.gm !== null && r.gv !== null;
  const empate = (r: Rascunho) => preenchido(r) && r.gm === r.gv;
  const abertos = alvo.jogos.filter(pode);
  const meio = abertos.some((j) => { const r = ver(j.id); return (r.gm === null) !== (r.gv === null); });
  const faltaClassificado = alvo.copa && abertos.some((j) => empate(ver(j.id)) && !ver(j.id).cl);
  const podeSalvar = sujo && !meio && !faltaClassificado && !ocupado && abertos.some((j) => preenchido(ver(j.id)));

  async function salvar() {
    setOcupado(true);
    setAviso('');
    try {
      const corpo = abertos.filter((j) => preenchido(ver(j.id))).map((j) => {
        const r = ver(j.id);
        return { [alvo!.copa ? 'copaJogoId' : 'jogoId']: j.id, golsMandante: r.gm, golsVisitante: r.gv, ...(alvo!.copa && r.gm === r.gv ? { classificadoId: r.cl } : {}) };
      });
      await api('/bolao/palpites', { method: 'PUT', body: JSON.stringify(corpo) });
      setOk('Palpites salvos.');
      carregarMeus(alvo!);
    } catch (e) {
      if (e instanceof ErroApi && e.codigo === 'PRAZO_ENCERRADO') setAviso409(true);
      else setAviso('Não deu para salvar os palpites. Tente de novo.');
    } finally {
      setOcupado(false);
    }
  }

  const primeiro = alvo.jogos[0];
  return (
    <div className="palpitar">
      <div className="chips-escolha" role="group" aria-label="Rodada ou fase">
        {alvos.map((a) => <button key={a.chave} type="button" aria-pressed={a.chave === alvo.chave} onClick={() => setEscolhido(a.chave)}>{a.rotulo}</button>)}
      </div>
      <Faixa prazo={alvo.prazo} agora={agora} encerradoPorErro={aviso409} />
      {aviso && <div className="aviso" role="alert">{aviso}</div>}
      {carregandoMeus ? <div aria-busy="true">{[0, 1, 2].map((i) => <div key={i} className="esqueleto" style={{ height: 116, marginTop: 8 }} />)}</div> : (
        <ul className="cartoes-palpite">
          {alvo.jogos.map((j) => {
            const r = ver(j.id);
            const aberto = pode(j);
            const pts = salvos[j.id]?.pontos;
            const mand = j.mandante.nome, vis = j.visitante.nome;
            return (
              <li key={j.id} className="cartao-palpite" aria-label={`${mand} contra ${vis}`}>
                <div className="linha-palpite">
                  <span className="clube-palpite"><Escudo src={j.mandante.escudoUrl} tam={28} /><b>{sigla(j.mandante.id)}</b></span>
                  <Placar nome={mand} valor={r.gm} travado={!aberto} aoMudar={(v) => muda(j.id, { gm: v, cl: null })} />
                </div>
                <div className="linha-palpite">
                  <span className="clube-palpite"><Escudo src={j.visitante.escudoUrl} tam={28} /><b>{sigla(j.visitante.id)}</b></span>
                  <Placar nome={vis} valor={r.gv} travado={!aberto} aoMudar={(v) => muda(j.id, { gv: v, cl: null })} />
                </div>
                {alvo.copa && empate(r) && (
                  <div className="quem-passa" role="group" aria-label="Quem passa nos pênaltis">
                    <span>Quem passa nos pênaltis</span>
                    {[j.mandante, j.visitante].map((c) => (
                      <button key={c.id} type="button" aria-pressed={r.cl === c.id} disabled={!aberto} onClick={() => muda(j.id, { cl: c.id })}><Escudo src={c.escudoUrl} tam={24} /><b>{sigla(c.id)}</b>{r.cl === c.id && <IcOk />}</button>
                    ))}
                  </div>
                )}
                {!aberto && (
                  <div className="rodape-palpite">
                    {pts !== null && pts !== undefined && <span className={`chip-pontos ${pts > 0 ? 'ganhou' : ''}`} aria-label={`${pts} ${pts === 1 ? 'ponto' : 'pontos'}`}>{pts > 0 ? `+${pts}` : pts}</span>}
                    {!alvo.prazo ? null : <Link para={`/bolao/jogo/${alvo.copa ? 'copa' : 'brasileirao'}/${j.id}`} className="link-outros">Palpites dos outros</Link>}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {!travado && faltaClassificado && <p className="faixa-prazo" role="status"><Alerta tam={24} />Empate no palpite: escolha quem passa. Acertar quem passa vale +1.</p>}
      <div role="status" className={ok ? 'toast' : 'sr'}>{ok}</div>
      <div className="acao-fixa">
        {travado
          ? <button type="button" className="botao secundario" disabled={!alvo.prazo || !primeiro} onClick={() => navegar(`/bolao/jogo/${alvo.copa ? 'copa' : 'brasileirao'}/${primeiro.id}`)}>Ver palpites dos outros</button>
          : <button type="button" className={`botao ${ok ? 'secundario' : ''}`} disabled={!podeSalvar} onClick={salvar}>{ocupado ? 'Salvando…' : 'Salvar palpites'}</button>}
      </div>
    </div>
  );
}

type Linha = { usuario: { id: string; nome: string; avatarUrl: string | null }; pontos: number; exatos: number; posicao: number };

export function Ranking({ me }: { me: Me }) {
  const [lista, setLista] = useState<Linha[] | 'carregando' | 'erro'>('carregando');
  function carregar() {
    setLista('carregando');
    api<Linha[]>('/bolao/ranking').then((l) => setLista(Array.isArray(l) ? l : []), () => setLista('erro'));
  }
  useEffect(carregar, []);
  if (lista === 'carregando') return <div aria-busy="true">{Array.from({ length: 6 }, (_, i) => <div key={i} className="esqueleto" style={{ height: 64, marginBottom: 4 }} />)}</div>;
  if (lista === 'erro') return <div className="caixa-info" role="alert"><h2>Não deu para carregar o ranking</h2><button type="button" className="botao secundario" onClick={carregar}>Tentar de novo</button></div>;
  if (lista.length === 0) return <div className="caixa-info"><Icone nome="bola" /><h2>Ninguém pontuou ainda</h2><p className="giz2">O ranking aparece depois que o admin lançar o primeiro placar com palpites.</p></div>;
  const idx = lista.findIndex((l) => l.usuario.id === me.id);
  return (
    <div>
      <p className="giz2 legenda-s">Brasileirão e Copa somados. Empate: mais exatos, depois o nome.</p>
      <ol className="ranking">
        {lista.map((l, i) => (
          <li key={l.usuario.id} className={`linha-pessoa ${i === idx ? 'minha' : ''}`} aria-current={i === idx ? 'true' : undefined}>
            <span className={`pos ${l.posicao <= 3 ? '' : 'giz2'}`}>{l.posicao}º</span>
            <Link para={`/u/${l.usuario.id}`} className="pessoa-rank">
              {l.usuario.avatarUrl ? <img className="av36" src={l.usuario.avatarUrl} alt="" width="36" height="36" /> : <span className="av36" aria-hidden="true">{l.usuario.nome[0]?.toUpperCase()}</span>}
              <strong>{l.usuario.nome}</strong>
            </Link>
            <span className="pts"><b>{l.pontos}</b><span className="giz2 legenda-s">{l.exatos} {l.exatos === 1 ? 'exato' : 'exatos'}</span></span>
          </li>
        ))}
      </ol>
    </div>
  );
}

// subabas Palpitar · Ranking (docs/design/pack3-onda-a.md §4 e §6)
export function Bolao({ me, inicial }: { me: Me; inicial: { rodada?: string | null; fase?: string | null } }) {
  const [sub, setSub] = useState<'palpitar' | 'ranking'>('palpitar');
  return (
    <div role="tabpanel" className="bolao">
      <div role="tablist" className="subabas" aria-label="Bolão">
        {([['palpitar', 'Palpitar'], ['ranking', 'Ranking']] as const).map(([id, nome]) => <button key={id} type="button" role="tab" aria-selected={sub === id} onClick={() => setSub(id)}>{nome}</button>)}
      </div>
      {sub === 'palpitar' ? <Palpitar inicial={inicial} /> : <Ranking me={me} />}
    </div>
  );
}
