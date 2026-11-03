import { useEffect, useState } from 'react';
import { api } from '../api/cliente';
import { Escudo } from '../feed/Escudo';
import { Folha } from '../feed/Folha';
import { IcFechar, IcFiltro, IcSeta } from '../feed/icones';
import { usePaginado } from '../paginado';
import { Link, useBusca } from '../rotas';
import { Detalhe } from './Detalhe';
import '../clube/clube.css';
import './galeria.css';

type ItemGaleria = { imagemId: string; postId: string; miniUrl: string; cheiaUrl: string; prompt: string; clube: { id: string; nome: string; escudoUrl: string } };
type ClubeLinha = { id: string; nome: string; escudoUrl: string };

export function Galeria() {
  const [clube, setClube] = useState<ClubeLinha | null>(null);
  const [filtrando, setFiltrando] = useState(false);
  const [clubes, setClubes] = useState<ClubeLinha[] | null>(null);
  const lista = usePaginado<ItemGaleria>('/galeria', { clube: clube?.id });
  const busca = useBusca();
  const imagem = busca.get('imagem');
  const postId = busca.get('post');

  useEffect(() => {
    if (filtrando && !clubes) api<ClubeLinha[]>('/clubes').then(setClubes, () => setClubes([]));
  }, [filtrando, clubes]);

  return (
    <div className="clube galeria">
      <h1 className="titulo-pagina">Galeria</h1>
      <p className="giz2 sub-pagina">Imagens com o prompt que as gerou.</p>
      <div className="chip-linha">
        {clube ? (
          <span className="chip ativo">
            <button type="button" className="chip-corpo" onClick={() => setFiltrando(true)}><Escudo src={clube.escudoUrl} tam={20} />{clube.nome}</button>
            <button type="button" aria-label="Remover filtro" onClick={() => setClube(null)}><IcFechar /></button>
          </span>
        ) : (
          <button type="button" className="chip" onClick={() => setFiltrando(true)}><IcFiltro />Todos os clubes<IcSeta /></button>
        )}
      </div>

      {lista.estado === 'carregando' && <div className="grade-capas" aria-busy="true">{Array.from({ length: 12 }, (_, i) => <div key={i} className="esqueleto" />)}</div>}
      {lista.estado === 'erro' && (
        <div className="caixa-info" role="alert"><h2>Não deu para carregar a galeria</h2><button type="button" className="botao secundario" onClick={lista.recarregar}>Tentar de novo</button></div>
      )}
      {lista.estado === 'ok' && lista.itens.length === 0 && (
        <div className="caixa-info">
          <h2>{clube ? `Ainda sem prompts do ${clube.nome}` : 'Ainda sem prompts'}</h2>
          <p className="giz2">Quando o técnico publicar uma imagem com prompt, ela aparece aqui.</p>
          {clube && <button type="button" className="botao secundario" onClick={() => setClube(null)}>Limpar filtro</button>}
        </div>
      )}
      <div className="grade-capas" role="list">
        {lista.itens.map((i) => (
          <div key={i.imagemId} role="listitem">
            <Link para={`/galeria?imagem=${i.imagemId}&post=${i.postId}`} aria-label={`Prompt de ${i.clube.nome}`}>
              <img src={i.miniUrl} alt="" loading="lazy" />
            </Link>
          </div>
        ))}
      </div>
      {lista.erroMais && <div className="caixa-info" role="alert"><p>Não deu para carregar mais.</p><button type="button" className="botao secundario" onClick={lista.maisUm}>Tentar de novo</button></div>}
      <div ref={lista.fim} />

      {filtrando && (
        <Folha titulo="Filtrar por clube" aoFechar={() => setFiltrando(false)} alta>
          <h2>Filtrar por clube</h2>
          <div role="radiogroup" aria-label="Clube" className="clubes">
            {[{ id: '', nome: 'Todos os clubes', escudoUrl: '' }, ...(clubes ?? [])].map((c) => (
              <button key={c.id} type="button" role="radio" aria-checked={(clube?.id ?? '') === c.id} className="opcao" onClick={() => { setClube(c.id ? c : null); setFiltrando(false); }}>
                {c.escudoUrl && <Escudo src={c.escudoUrl} tam={40} />}
                {c.nome}
                <span className="marcador" aria-hidden="true">{(clube?.id ?? '') === c.id && '✓'}</span>
              </button>
            ))}
          </div>
        </Folha>
      )}
      {imagem && postId && <Detalhe imagemId={imagem} postId={postId} />}
    </div>
  );
}
