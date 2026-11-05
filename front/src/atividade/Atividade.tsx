import { useEffect, useRef, useState } from 'react';
import { api } from '../api/cliente';
import { Escudo } from '../feed/Escudo';
import { Icone } from '../feed/icones';
import { haQuanto } from '../feed/tipos';
import { usePaginado } from '../paginado';
import { Link } from '../rotas';
import './atividade.css';

type Tipo = 'REACAO' | 'COMENTARIO' | 'MENCAO' | 'CBF_CITOU' | 'TROCA_DECIDIDA' | 'CONQUISTA' | 'RESPOSTA';
export type ItemAtividade = {
  id: string; tipo: Tipo; criadoEm: string; lida: boolean;
  ator: { id: string; nome: string; avatarUrl: string | null } | null;
  post: { id: string; miniUrl: string | null; resumo: string } | null;
  comentario?: { id?: string; resumo: string } | null; // trecho do comentário (COMENTARIO, RESPOSTA e MENCAO dentro de comentário)
  conquista?: { tipo: string; nome: string } | null; // CONQUISTA (ator null)
  troca?: { status: string; clube?: { id: string; nome: string } | null } | null; // TROCA_DECIDIDA (status vem do back)
};
const SELO = { REACAO: 'curtir', COMENTARIO: 'comentar', MENCAO: 'perfil', CBF_CITOU: 'liga', TROCA_DECIDIDA: 'ok', CONQUISTA: 'trofeu', RESPOSTA: 'responder' } as const;
const INDISPONIVEL = 'Post indisponível';

function texto(i: ItemAtividade) {
  const nome = i.ator?.nome ?? '';
  const resumo = i.post?.resumo ?? '';
  const sem = !i.post || resumo === INDISPONIVEL; // ocultado: sem legenda nem comentário
  // comentário oculto/apagado: o back manda 'Comentário indisponível' e não se cita nada
  const trecho = i.comentario?.resumo && i.comentario.resumo !== 'Comentário indisponível' ? i.comentario.resumo : null;
  switch (i.tipo) {
    case 'REACAO': return <><b>{nome}</b> reagiu {sem ? 'a um post' : 'ao post'}</>;
    // o resumo do post NÃO é o comentário: sem `comentario.resumo` (back antigo) não se cita nada
    case 'COMENTARIO': return trecho ? <><b>{nome}</b> comentou: “{trecho}”</> : <><b>{nome}</b> comentou {sem ? 'em um post' : 'no post'}</>;
    case 'MENCAO': return trecho ? <><b>{nome}</b> mencionou você: “{trecho}”</> : i.comentario ? <><b>{nome}</b> mencionou você em um comentário</> : sem ? <><b>{nome}</b> mencionou você</> : <><b>{nome}</b> mencionou você: “{resumo}”</>;
    case 'CBF_CITOU': return <>CBF citou você no comunicado da rodada</>;
    // sem `troca.status` (back antigo) o texto é neutro
    case 'TROCA_DECIDIDA': return /aprov/i.test(i.troca?.status ?? '') ? <>Seu pedido de troca foi aprovado.</> : /recus/i.test(i.troca?.status ?? '') ? <>Seu pedido de troca foi recusado.</> : <>Seu pedido de troca foi decidido.</>;
    case 'RESPOSTA': return trecho ? <><b>{nome}</b> respondeu: “{trecho}”</> : <><b>{nome}</b> respondeu a um comentário seu</>;
    case 'CONQUISTA': return <>Você conquistou <b>{i.conquista?.nome ?? 'uma conquista'}</b>.</>;
  }
}
const destino = (i: ItemAtividade, meuId?: string) => {
  if (i.tipo === 'CONQUISTA') return meuId ? `/u/${meuId}` : null;
  if (i.post?.resumo === INDISPONIVEL) return null;
  if (i.tipo === 'TROCA_DECIDIDA') return i.troca?.clube ? `/c/${i.troca.clube.id}` : '/perfil';
  if (i.tipo === 'RESPOSTA') return i.post ? `/p/${i.post.id}?comentarios=1` : null; // abre o post com a folha de comentários
  return i.post ? `/p/${i.post.id}` : null;
};

function Linha({ i, nova, meuId }: { i: ItemAtividade; nova: boolean; meuId?: string }) {
  const indisponivel = i.post?.resumo === INDISPONIVEL;
  const para = destino(i, meuId);
  const corpo = (
    <>
      {nova && <span className="ponto-novo" aria-hidden="true" />}
      <span className="av-ativ">
        {i.tipo === 'CONQUISTA' ? <span className="av-inicial-ativ trofeu-ativ" aria-hidden="true"><Icone nome="trofeu" /></span> : i.tipo === 'CBF_CITOU' ? <img src="/escudos/cbf.svg" alt="" width="36" height="44" /> : i.ator?.avatarUrl ? <img src={i.ator.avatarUrl} alt="" width="44" height="44" /> : <span className="av-inicial-ativ" aria-hidden="true">{(i.ator?.nome ?? '·')[0]?.toUpperCase()}</span>}
        {i.tipo !== 'CONQUISTA' && <span className="selo-tipo" aria-hidden="true"><Icone nome={SELO[i.tipo]} /></span>}
      </span>
      <span className="corpo-ativ">
        <span className="texto-ativ">{texto(i)}</span>
        <span className="giz2 legenda-s">{indisponivel ? `Post indisponível · ${haQuanto(i.criadoEm).replace('há ', '')}` : haQuanto(i.criadoEm)}</span>
      </span>
      {i.post && (i.post.miniUrl ? <img className="mini-ativ" src={i.post.miniUrl} alt="" width="44" height="44" /> : <span className="mini-ativ vazia" aria-hidden="true"><Icone nome="galeria" /></span>)}
    </>
  );
  const ator = i.tipo !== 'CBF_CITOU' && i.ator ? i.ator : null;
  return (
    <li className="li-ativ">
      {para ? <Link para={para} className={`item-ativ ${nova ? 'nova' : ''}`}>{corpo}</Link> : <div className={`item-ativ ${nova ? 'nova' : ''}`}>{corpo}</div>}
      {/* o avatar leva ao perfil do técnico; fica ao lado (não dentro) do link da linha */}
      {ator && <Link para={`/u/${ator.id}`} className={`ativ-perfil ${nova ? 'nova' : ''}`} aria-label={`Perfil de ${ator.nome}`} />}
    </li>
  );
}

// /atividade: abrir marca tudo como lido, mas nesta visita os itens que chegaram novos continuam destacados
export function Atividade({ meuId }: { meuId?: string }) {
  const lista = usePaginado<ItemAtividade>('/atividade');
  const novas = useRef<Set<string> | null>(null);
  const [, forcar] = useState(0);
  useEffect(() => {
    if (lista.estado !== 'ok' || novas.current) return;
    novas.current = new Set(lista.itens.filter((i) => !i.lida).map((i) => i.id));
    forcar((n) => n + 1);
    api('/atividade/lidas', { method: 'POST' }).catch(() => {});
  }, [lista.estado, lista.itens]);
  const ehNova = (i: ItemAtividade) => novas.current?.has(i.id) || (!i.lida && !novas.current);
  const novos = lista.itens.filter(ehNova);
  const antigos = lista.itens.filter((i) => !ehNova(i));
  return (
    <div className="tela atividade">
      <h1>Atividade</h1>
      {lista.estado === 'carregando' && <div aria-busy="true">{Array.from({ length: 8 }, (_, i) => <div key={i} className="esqueleto" style={{ height: 72, marginBottom: 1 }} />)}</div>}
      {lista.estado === 'erro' && <div className="caixa-info" role="alert"><h2>Não deu para carregar a atividade</h2><button type="button" className="botao secundario" onClick={lista.recarregar}>Tentar de novo</button></div>}
      {lista.estado === 'ok' && lista.itens.length === 0 && <div className="caixa-info"><h2>Nada por aqui ainda</h2><p className="giz2">Quando alguém reagir ao post do seu clube, comentar ou mencionar você, aparece aqui.</p></div>}
      {novos.length > 0 && <><h2 className="secao-ativ">Novas</h2><ul className="lista-ativ">{novos.map((i) => <Linha key={i.id} i={i} nova meuId={meuId} />)}</ul></>}
      {antigos.length > 0 && <><h2 className="secao-ativ">Mais antigas</h2><ul className="lista-ativ">{antigos.map((i) => <Linha key={i.id} i={i} nova={false} meuId={meuId} />)}</ul></>}
      {lista.erroMais && <div className="caixa-info" role="alert"><p>Não deu para carregar mais.</p><button type="button" className="botao secundario" onClick={lista.maisUm}>Tentar de novo</button></div>}
      <div ref={lista.fim} />
    </div>
  );
}
