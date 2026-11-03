import { useState } from 'react';
import { navegar } from '../rotas';
import type { Post } from './tipos';

// proporção do quadro = a da 1ª imagem, entre 4:5 e 1,91:1 (fora disso a imagem fica inteira dentro do quadro)
export function proporcao(p: Post) {
  const { largura, altura } = p.imagens[0];
  return Math.min(1.91, Math.max(0.8, largura / altura));
}

export function Carrossel({ post, prioridade, aoDuploToque }: { post: Post; prioridade?: boolean; aoDuploToque: () => void }) {
  const [atual, setAtual] = useState(0);
  const total = post.imagens.length;
  const img = post.imagens[atual];
  return (
    <div className="carrossel-moldura">
      <div
        className="carrossel"
        role="group"
        aria-roledescription="carrossel"
        aria-label="Imagens do post"
        style={{ aspectRatio: `${proporcao(post)} / 1` }}
        onScroll={(e) => setAtual(Math.round(e.currentTarget.scrollLeft / (e.currentTarget.clientWidth || 1)))}
        onDoubleClick={aoDuploToque}
      >
        {post.imagens.map((im, i) => (
          <img
            key={im.id}
            src={im.miniUrl}
            alt={`Imagem ${i + 1} de ${total}: ${post.legenda.slice(0, 80)}`}
            loading={prioridade && i === 0 ? 'eager' : 'lazy'}
            decoding="async"
          />
        ))}
      </div>
      {total > 1 && <span className="contador">{atual + 1}/{total}</span>}
      {img?.prompt && (
        <button type="button" className="ver-prompt" onClick={() => navegar(`/galeria?imagem=${img.id}`)}>Ver prompt</button>
      )}
      {total > 1 && (
        <div className="pontos" aria-hidden="true">{post.imagens.map((im, i) => <span key={im.id} className={i === atual ? 'ativo' : ''} />)}</div>
      )}
    </div>
  );
}
