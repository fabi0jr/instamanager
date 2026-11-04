import { useEffect, useRef, useState } from 'react';
import { api } from '../api/cliente';
import { Escudo } from '../feed/Escudo';
import { Icone } from '../feed/icones';
import { haQuanto } from '../feed/tipos';
import { usePaginado } from '../paginado';
import { Link } from '../rotas';
import './atividade.css';

type Tipo = 'REACAO' | 'COMENTARIO' | 'MENCAO' | 'CBF_CITOU' | 'TROCA_DECIDIDA' | 'VOTACAO_RESULTADO';
export type ItemAtividade = {
  id: string; tipo: Tipo; criadoEm: string; lida: boolean;
  ator: { id: string; nome: string; avatarUrl: string | null } | null;
  post: { id: string; miniUrl: string | null; resumo: string } | null;
  votacao: { id: string; titulo: string } | null;
  clube?: { id: string; nome: string } | null; // troca decidida
  aprovada?: boolean;
};
const SELO = { REACAO: 'curtir', COMENTARIO: 'comentar', MENCAO: 'perfil', CBF_CITOU: 'liga', TROCA_DECIDIDA: 'ok', VOTACAO_RESULTADO: 'votacao' } as const;
const INDISPONIVEL = 'Post indisponível';

function texto(i: ItemAtividade) {
  const nome = i.ator?.nome ?? '';
  const resumo = i.post?.resumo ?? '';
  const sem = !i.post || resumo === INDISPONIVEL; // ocultado: sem legenda nem comentário
  switch (i.tipo) {
    case 'REACAO': return <><b>{nome}</b> reagiu {sem ? 'a um post' : 'ao post'}</>;
    case 'COMENTARIO': return sem ? <><b>{nome}</b> comentou em um post</> : <><b>{nome}</b> comentou: “{resumo}”</>;
    case 'MENCAO': return sem ? <><b>{nome}</b> mencionou você</> : <><b>{nome}</b> mencionou você: “{resumo}”</>;
    case 'CBF_CITOU': return <>CBF citou você no comunicado da rodada</>;
    // a API ainda não diz se foi aprovada ou recusada (item sem esse campo): texto neutro, o detalhe está no Perfil
    case 'TROCA_DECIDIDA': return i.aprovada === undefined ? <>Seu pedido de troca foi decidido.</> : i.aprovada ? <>Seu pedido de troca foi aprovado.</> : <>Seu pedido de troca foi recusado.</>;
    case 'VOTACAO_RESULTADO': return <>Resultado de {i.votacao?.titulo ?? 'votação'}</>;
  }
}
const destino = (i: ItemAtividade) => {
  if (i.post?.resumo === INDISPONIVEL) return null;
  if (i.tipo === 'TROCA_DECIDIDA') return i.clube ? `/c/${i.clube.id}` : '/perfil';
  if (i.tipo === 'VOTACAO_RESULTADO' && i.votacao) return `/votacoes/${i.votacao.id}`;
  return i.post ? `/p/${i.post.id}` : null;
};

function Linha({ i, nova }: { i: ItemAtividade; nova: boolean }) {
  const indisponivel = i.post?.resumo === INDISPONIVEL;
  const para = destino(i);
  const corpo = (
    <>
      {nova && <span className="ponto-novo" aria-hidden="true" />}
      <span className="av-ativ">
        {i.tipo === 'CBF_CITOU' ? <img src="/escudos/cbf.svg" alt="" width="36" height="44" /> : i.ator?.avatarUrl ? <img src={i.ator.avatarUrl} alt="" width="44" height="44" /> : <span className="av-inicial-ativ" aria-hidden="true">{(i.ator?.nome ?? '·')[0]?.toUpperCase()}</span>}
        <span className="selo-tipo" aria-hidden="true"><Icone nome={SELO[i.tipo]} /></span>
      </span>
      <span className="corpo-ativ">
        <span className="texto-ativ">{texto(i)}</span>
        <span className="giz2 legenda-s">{indisponivel ? `Post indisponível · ${haQuanto(i.criadoEm).replace('há ', '')}` : haQuanto(i.criadoEm)}</span>
      </span>
      {i.post && (i.post.miniUrl ? <img className="mini-ativ" src={i.post.miniUrl} alt="" width="44" height="44" /> : <span className="mini-ativ vazia" aria-hidden="true"><Icone nome="galeria" /></span>)}
    </>
  );
  return <li>{para ? <Link para={para} className={`item-ativ ${nova ? 'nova' : ''}`}>{corpo}</Link> : <div className={`item-ativ ${nova ? 'nova' : ''}`}>{corpo}</div>}</li>;
}

// /atividade: abrir marca tudo como lido, mas nesta visita os itens que chegaram novos continuam destacados
export function Atividade() {
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
      {novos.length > 0 && <><h2 className="secao-ativ">Novas</h2><ul className="lista-ativ">{novos.map((i) => <Linha key={i.id} i={i} nova />)}</ul></>}
      {antigos.length > 0 && <><h2 className="secao-ativ">Mais antigas</h2><ul className="lista-ativ">{antigos.map((i) => <Linha key={i.id} i={i} nova={false} />)}</ul></>}
      {lista.erroMais && <div className="caixa-info" role="alert"><p>Não deu para carregar mais.</p><button type="button" className="botao secundario" onClick={lista.maisUm}>Tentar de novo</button></div>}
      <div ref={lista.fim} />
    </div>
  );
}
