import { IcGaleria, IcTexto } from './icones';
import { Link } from '../rotas';
import type { Post } from './tipos';

// Grade de capas (clube e tag): post só de texto vira um quadrado com as primeiras palavras
export function GradeCapas({ posts }: { posts: Post[] }) {
  return (
    <div className="grade-capas" role="list">
      {posts.map((p) => (
        <div key={p.id} role="listitem">
          {p.imagens.length === 0 ? (
            <Link para={`/p/${p.id}`} aria-label={`Post de texto de ${p.autor.nome}, ${p.clube.nome}`} className="capa-texto">
              <span>{p.texto ?? p.legenda}</span>
              <span className="multi"><IcTexto /></span>
            </Link>
          ) : (
            <Link para={`/p/${p.id}`} aria-label={`Post de ${p.autor.nome}, ${p.clube.nome}, ${p.imagens.length} ${p.imagens.length === 1 ? 'imagem' : 'imagens'}`}>
              <img src={p.imagens[0].miniUrl} alt="" loading="lazy" />
              {p.imagens.length > 1 && <span className="multi"><IcGaleria /></span>}
            </Link>
          )}
        </div>
      ))}
    </div>
  );
}
