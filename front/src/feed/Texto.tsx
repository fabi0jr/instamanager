import { Fragment } from 'react';
import { Link } from '../rotas';

// `#tag` = # + palavra com ao menos uma letra. Não conta: colado em palavra (a#b), depois de / & # (URL, ##) nem número puro (#123).
const TAG = /(?<![\p{L}\p{N}_/&#])#([\p{L}\p{N}_]*\p{L}[\p{L}\p{N}_]*)/gu;

// Sem acento e sem maiúsculas, como o back compara
export const chaveDaTag = (t: string) => t.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

// Texto de legenda/post/comentário com as #tags viradas em link para /tag/<palavra>
export function Texto({ children }: { children: string }) {
  const partes: (string | { tag: string })[] = [];
  let fim = 0;
  for (const m of children.matchAll(TAG)) {
    partes.push(children.slice(fim, m.index), { tag: m[1] });
    fim = m.index + m[0].length;
  }
  partes.push(children.slice(fim));
  return (
    <>
      {partes.map((p, i) =>
        typeof p === 'string' ? (
          <Fragment key={i}>{p}</Fragment>
        ) : (
          <Link key={i} para={`/tag/${encodeURIComponent(chaveDaTag(p.tag))}`} className="hashtag">#{p.tag}</Link>
        ),
      )}
    </>
  );
}
