import { useEffect, useState } from 'react';
import { api, ErroApi } from '../api/cliente';
import { Aviso, Botao } from '../conta/ui';
import { IcOk, IcVotacao } from '../feed/icones';
import { Link, voltar } from '../rotas';
import { prazoTexto, vencedores, type Votacao } from './tipos';
import './votacoes.css';

// aba Votações da Liga: as não encerradas (a API não lista as encerradas)
export function ListaVotacoes() {
  const [lista, setLista] = useState<Votacao[] | 'carregando' | 'erro'>('carregando');
  function carregar() {
    setLista('carregando');
    api<Votacao[]>('/votacoes').then(setLista, () => setLista('erro'));
  }
  useEffect(carregar, []);
  if (lista === 'carregando') return <div aria-busy="true"><div className="esqueleto" /></div>;
  if (lista === 'erro') return <div className="caixa-info" role="alert"><h2>Não deu para carregar as votações</h2><button type="button" className="botao secundario" onClick={carregar}>Tentar de novo</button></div>;
  if (!lista.length) return <p className="giz2 padrao">Nenhuma votação aberta agora.</p>;
  return (
    <ul className="votacoes-lista">
      {lista.map((v) => (
        <li key={v.id} className="cartao-votacao">
          <IcVotacao />
          <div>
            <h3>{v.titulo}</h3>
            <p className="giz2 legenda-s">{v.opcoes.length} concorrentes · voto secreto</p>
            {v.meuVoto ? <span className="etiqueta fechada"><IcOk /> Você votou · resultado ao fechar</span> : v.aberta ? <span className="etiqueta aberta">{prazoTexto(v.prazo)}</span> : <span className="etiqueta">Aguardando o admin</span>}
          </div>
          {!v.meuVoto && v.aberta && <Link para={`/votacoes/${v.id}`} className="botao">Votar</Link>}
        </li>
      ))}
    </ul>
  );
}

// aviso no topo do feed: só quando há votação aberta que a pessoa ainda não votou
export function AvisoVotacao() {
  const [v, setV] = useState<Votacao>();
  useEffect(() => {
    api<Votacao[]>('/votacoes').then((l) => Array.isArray(l) && setV(l.find((x) => x.aberta && !x.meuVoto)), () => {});
  }, []);
  if (!v) return null;
  return <Link para={`/votacoes/${v.id}`} className="aviso-votacao"><IcVotacao /> <span>Votação aberta: {v.titulo}</span> <strong>Votar</strong></Link>;
}

export function Votar({ id }: { id: string }) {
  const [v, setV] = useState<Votacao | 'carregando' | 'erro'>('carregando');
  const [escolha, setEscolha] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState('');
  const [registrado, setRegistrado] = useState(false);
  function carregar() {
    setV('carregando');
    api<Votacao>(`/votacoes/${id}`).then(setV, () => setV('erro'));
  }
  useEffect(carregar, [id]);

  async function confirmar() {
    setOcupado(true);
    setAviso('');
    try {
      await api(`/votacoes/${id}/voto`, { method: 'POST', body: JSON.stringify({ opcao: escolha }) });
      setRegistrado(true);
      setV((x) => (typeof x === 'object' ? { ...x, meuVoto: escolha } : x));
    } catch (e) {
      if (e instanceof ErroApi && e.codigo === 'JA_VOTOU') { setAviso('Você já votou nesta votação.'); carregar(); }
      else if (e instanceof ErroApi && e.codigo === 'VOTACAO_ENCERRADA') carregar();
      else setAviso('Não deu para votar. Tente de novo.');
    } finally {
      setOcupado(false);
    }
  }

  if (v === 'carregando') return <div className="tela votar"><div className="esqueleto" aria-busy="true" /></div>;
  if (v === 'erro') return <div className="tela votar"><div className="caixa-info" role="alert"><h2>Não deu para carregar a votação</h2><button type="button" className="botao secundario" onClick={carregar}>Tentar de novo</button></div></div>;

  const total = v.resultado?.reduce((n, r) => n + r.votos, 0) ?? 0;
  const ganhou = v.resultado ? vencedores(v.resultado) : [];
  const travada = !!v.meuVoto || !v.aberta;
  return (
    <div className="tela votar">
      <button type="button" className="link" onClick={() => voltar('/liga')}>‹ Voltar</button>
      <h1>{v.titulo}</h1>
      <Aviso>{aviso}</Aviso>
      <div role="status" className="sr">{registrado ? 'Seu voto foi registrado.' : ''}</div>
      {v.encerrada && v.resultado ? (
        <>
          <p className="giz2">{total} {total === 1 ? 'voto' : 'votos'} · resultado final</p>
          <ol className="resultado">
            {v.resultado.map((r) => {
              const pct = total ? Math.round((r.votos / total) * 100) : 0;
              return (
                <li key={r.opcao} className={ganhou.some((g) => g.opcao === r.opcao) ? 'vencedor' : ''}>
                  <span>{r.rotulo}{v.meuVoto === r.opcao && <em> · seu voto</em>}</span>
                  <strong aria-label={`${pct}%, ${r.votos} ${r.votos === 1 ? 'voto' : 'votos'}`}>{pct}%</strong>
                  <i style={{ width: `${pct}%` }} />
                </li>
              );
            })}
          </ol>
          {ganhou.length > 0 && <p className="aviso-gramado">Selo para {ganhou.map((g) => g.rotulo).join(' e ')}, agora no perfil do clube.</p>}
        </>
      ) : (
        <>
          {v.meuVoto && <p className="aviso-gramado">Seu voto está guardado. O resultado aparece quando a votação fechar.</p>}
          {!v.aberta && !v.meuVoto && <p className="aviso-ambar">O prazo acabou. O admin ainda vai fechar a votação e divulgar o resultado.</p>}
          <div role="radiogroup" aria-label="Opções" className="opcoes-voto">
            {v.opcoes.map((o) => {
              const marcada = (v.meuVoto ?? escolha) === o.id;
              return (
                <button key={o.id} type="button" role="radio" aria-checked={marcada} disabled={travada} className={marcada ? 'marcada' : ''} onClick={() => setEscolha(o.id)}>
                  <span>{o.rotulo}</span>{v.meuVoto === o.id && <em>Seu voto</em>}
                </button>
              );
            })}
          </div>
          <div className="acao-fixa">
            {!v.meuVoto && <Botao disabled={!escolha || !v.aberta} carregando={ocupado ? 'Enviando…' : undefined} onClick={confirmar}>{v.aberta ? 'Confirmar voto' : 'Votação encerrada'}</Botao>}
            {!v.meuVoto && v.aberta && <p className="giz2 legenda-s">Depois de enviado, o voto não muda.</p>}
          </div>
        </>
      )}
    </div>
  );
}
