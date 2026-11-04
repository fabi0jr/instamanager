import { Injectable } from '@nestjs/common';
import type { UserComClube } from '../auth/auth.service.js';
import { AtividadeService } from '../atividade/atividade.service.js';
import { ApiError } from '../http.js';
import { escaparLike } from '../like.js';
import { PostsService } from '../posts/posts.service.js';
import { PrismaService } from '../prisma.service.js';

const POR_PAGINA = 20;
const TIPOS = ['posts', 'prompts', 'clubes', 'pessoas'] as const;
const invalido = (msg: string, campo: string) => new ApiError(400, 'DADOS_INVALIDOS', msg, [campo]);

/** Clubes e pessoas são poucos: o cursor é só a posição (número) na lista ordenada por nome. */
const lerPosicao = (antes?: string) => {
  if (antes === undefined || antes === '') return 0;
  if (!/^\d{1,6}$/.test(antes)) throw invalido('Cursor inválido.', 'antes');
  return Number(antes);
};

@Injectable()
export class BuscaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly posts: PostsService,
    private readonly atividade: AtividadeService,
  ) {}

  async buscar(user: UserComClube, q: unknown, tipo: unknown, antes?: string) {
    const t = typeof q === 'string' ? q.trim() : '';
    if (t.length < 2 || t.length > 60) throw invalido('Digite de 2 a 60 caracteres para buscar.', 'q');
    if (typeof tipo !== 'string' || !TIPOS.includes(tipo as (typeof TIPOS)[number])) throw invalido(`tipo precisa ser ${TIPOS.join(', ')}.`, 'tipo');
    if (tipo === 'posts' || tipo === 'prompts') return this.posts.pesquisar(user, tipo, t, antes);
    const pular = lerPosicao(antes);
    const itens = tipo === 'clubes' ? await this.clubes(t, POR_PAGINA + 1, pular) : await this.atividade.pessoas(t, POR_PAGINA + 1, pular);
    return { itens: itens.slice(0, POR_PAGINA), proximo: itens.length > POR_PAGINA ? String(pular + POR_PAGINA) : null };
  }

  /** Sem a CBF (ela só aparece em /clubes/cbf e como autora de posts). */
  private async clubes(q: string, limite: number, pular: number) {
    const p = escaparLike(q);
    const ids = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM "Club" WHERE NOT oficial AND lower(unaccent(name)) LIKE '%' || lower(unaccent(${p})) || '%'
      ORDER BY name ASC, id ASC LIMIT ${limite} OFFSET ${pular}`;
    const cs = await this.prisma.club.findMany({ where: { id: { in: ids.map((i) => i.id) } }, include: { coach: { select: { id: true, name: true } } } });
    return ids.flatMap(({ id }) => cs.filter((c) => c.id === id)).map((c) => ({ id: c.id, nome: c.name, escudoUrl: c.crestPath, tecnico: c.coach && { id: c.coach.id, nome: c.coach.name } }));
  }
}
