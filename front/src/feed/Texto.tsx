import { Fragment } from 'react';
import { Link } from '../rotas';
import { MARCA, type Mencao } from '../mencoes/mencoes';

// `#tag` = # + palavra com ao menos uma letra. Não conta: colado em palavra (a#b), depois de / & # (URL, ##) nem número puro (#123).
const TAG = /(?<![\p{L}\p{N}_/&#])#([\p{L}\p{N}_]*\p{L}[\p{L}\p{N}_]*)/gu;

// Sem acento e sem maiúsculas, como o back compara
export const chaveDaTag = (t: string) => t.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

// Texto de legenda/post/comentário com as #tags viradas em link para /tag/<palavra>
// `mencoes` vem do back com o nome de hoje, do banco: a marca @[Nome](id) vira chip com esse nome; id fora da lista (ou sem lista, como na bio) = "@pessoa removida"
export function Texto({ children, mencoes }: { children: string; mencoes?: Mencao[] }) {
  const partes: (string | { tag: string } | { mencao: string; nome?: string })[] = [];
  const achados = [
    ...[...children.matchAll(TAG)].map((m) => ({ i: m.index, len: m[0].length, p: { tag: m[1] } as const })),
    ...[...children.matchAll(MARCA)].map((m) => ({ i: m.index, len: m[0].length, p: { mencao: m[1], nome: mencoes?.find((x) => x.id === m[2])?.nome } as const })),
  ].sort((a, b) => a.i - b.i);
  let fim = 0;
  for (const a of achados) {
    if (a.i < fim) continue;
    partes.push(children.slice(fim, a.i), a.p);
    fim = a.i + a.len;
  }
  partes.push(children.slice(fim));
  return (
    <>
      {partes.map((p, i) =>
        typeof p === 'string' ? (
          <Fragment key={i}>{p}</Fragment>
        ) : 'mencao' in p ? (
          p.nome ? <span key={i} className="chip-mencao">@{p.nome}</span> : <span key={i} className="chip-mencao removida">@pessoa removida</span>
        ) : (
          <Link key={i} para={`/tag/${encodeURIComponent(chaveDaTag(p.tag))}`} className="hashtag">#{p.tag}</Link>
        ),
      )}
    </>
  );
}
