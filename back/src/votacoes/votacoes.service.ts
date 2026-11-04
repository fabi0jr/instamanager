import { Injectable } from '@nestjs/common';
import type { UserComClube } from '../auth/auth.service.js';
import { Prisma, type Votacao, type VotacaoTipo } from '../generated/prisma/client.js';
import { ApiError } from '../http.js';
import { UUID } from '../posts/cursor.js';
import { AtividadeService } from '../atividade/atividade.service.js';
import { PostsService } from '../posts/posts.service.js';
import { PrismaService } from '../prisma.service.js';

const TIPOS: VotacaoTipo[] = ['CLUBE', 'TECNICO', 'POST'];
const MAX_TITULO = 100;
const MAX_OPCOES = 10;
const MAX_TEXTO = 500;
const invalido = (msg: string, campo: string) => new ApiError(400, 'DADOS_INVALIDOS', msg, [campo]);
const naoEncontrado = () => new ApiError(404, 'NAO_ENCONTRADO', 'Votação não encontrada.');
const encerrada = () => new ApiError(409, 'VOTACAO_ENCERRADA', 'Esta votação já foi encerrada.');
const curto = (t: string, n: number) => (t.length > n ? `${t.slice(0, n - 1)}…` : t);

@Injectable()
export class VotacoesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly posts: PostsService,
    private readonly atividade: AtividadeService,
  ) {}

  async criar(user: UserComClube, corpo: unknown) {
    const { titulo, tipo, opcoes, prazo } = (typeof corpo === 'object' && corpo ? corpo : {}) as Record<string, unknown>;
    if (typeof titulo !== 'string' || !titulo.trim() || titulo.trim().length > MAX_TITULO) throw invalido(`O título tem de 1 a ${MAX_TITULO} caracteres.`, 'titulo');
    if (!TIPOS.includes(tipo as VotacaoTipo)) throw invalido("tipo precisa ser 'CLUBE', 'TECNICO' ou 'POST'.", 'tipo');
    if (!Array.isArray(opcoes) || opcoes.length < 2 || opcoes.length > MAX_OPCOES || opcoes.some((o) => typeof o !== 'string' || !o) || new Set(opcoes).size !== opcoes.length)
      throw invalido(`Envie de 2 a ${MAX_OPCOES} opções diferentes (ids).`, 'opcoes');
    const data = typeof prazo === 'string' ? new Date(prazo) : null;
    if (!data || Number.isNaN(data.getTime()) || data.getTime() <= Date.now()) throw invalido('O prazo precisa ser uma data futura (ISO 8601).', 'prazo');
    await this.exigirOpcoes(tipo as VotacaoTipo, opcoes as string[]);
    const v = await this.prisma.votacao.create({ data: { titulo: titulo.trim(), tipo: tipo as VotacaoTipo, opcoes: opcoes as string[], prazo: data, criadaPor: user.id } });
    return this.json(v, null, false);
  }

  async listar(user: UserComClube) {
    const lista = await this.prisma.votacao.findMany({ where: { encerradaEm: null }, orderBy: [{ prazo: 'asc' }, { id: 'asc' }] });
    const meus = await this.prisma.voto.findMany({ where: { userId: user.id, votacaoId: { in: lista.map((v) => v.id) } } });
    return Promise.all(lista.map((v) => this.json(v, meus.find((m) => m.votacaoId === v.id)?.opcao ?? null, false)));
  }

  /** As 50 últimas encerradas, da mais nova à mais velha: só o nome do vencedor (empate: nomes com ' e '; sem votos: null). */
  async encerradas() {
    const lista = await this.prisma.votacao.findMany({ where: { encerradaEm: { not: null } }, orderBy: [{ encerradaEm: 'desc' }, { id: 'asc' }], take: 50 });
    return Promise.all(
      lista.map(async (v) => {
        const r = await this.apurar(this.prisma, v);
        const topo = r[0]?.votos ?? 0;
        return { ...(await this.json(v, null, true, r)), encerradaEm: v.encerradaEm, vencedor: topo > 0 ? r.filter((x) => x.votos === topo).map((x) => x.rotulo).join(' e ') : null };
      }),
    );
  }

  async obter(id: string, user: UserComClube) {
    const v = await this.buscar(id);
    const meu = await this.prisma.voto.findUnique({ where: { votacaoId_userId: { votacaoId: id, userId: user.id } } });
    return this.json(v, meu?.opcao ?? null, v.encerradaEm !== null);
  }

  async votar(id: string, user: UserComClube, corpo: unknown) {
    const v = await this.buscar(id);
    if (v.encerradaEm || v.prazo.getTime() <= Date.now()) throw encerrada();
    const opcao = typeof corpo === 'object' && corpo ? (corpo as { opcao?: unknown }).opcao : undefined;
    if (typeof opcao !== 'string' || !(v.opcoes as string[]).includes(opcao)) throw invalido('Escolha uma das opções da votação.', 'opcao');
    try {
      await this.prisma.voto.create({ data: { votacaoId: id, userId: user.id, opcao } });
    } catch (e) {
      // a chave (votacaoId, userId) garante 1 voto por pessoa mesmo com dois cliques ao mesmo tempo
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new ApiError(409, 'JA_VOTOU', 'Você já votou nesta votação.');
      throw e;
    }
  }

  /** Fecha, dá o selo a quem teve mais votos (empate: todos os empatados; sem votos: ninguém) e publica o resultado pela CBF. */
  async encerrar(user: UserComClube, id: string) {
    const v = await this.buscar(id);
    const { resultado, vencedores } = await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.votacao.updateMany({ where: { id, encerradaEm: null }, data: { encerradaEm: new Date() } });
      if (count === 0) throw encerrada();
      const resultado = await this.apurar(tx, v);
      const topo = Math.max(0, ...resultado.map((r) => r.votos));
      const vencedores = topo > 0 ? resultado.filter((r) => r.votos === topo) : [];
      const clubes = new Set((await Promise.all(vencedores.map((w) => this.clubeDe(tx, v.tipo, w.opcao)))).filter((c): c is string => c !== null));
      if (clubes.size) await tx.selo.createMany({ data: [...clubes].map((clubId) => ({ clubId, titulo: v.titulo, votacaoId: id })) });
      return { resultado, vencedores };
    });
    const texto = vencedores.length
      ? `Resultado da votação "${v.titulo}":\n${vencedores.map((w) => w.rotulo).join(' e ')} ${vencedores.length > 1 ? 'empataram' : 'venceu'} com ${vencedores[0].votos} voto${vencedores[0].votos > 1 ? 's' : ''}.`
      : `A votação "${v.titulo}" fechou sem nenhum voto.`;
    const post = await this.posts.criar(user, { comoCbf: true, texto: curto(texto, MAX_TEXTO) }, [], []);
    // o resultado vai para todo mundo (menos o admin que encerrou)
    const todos = await this.prisma.user.findMany({ where: { id: { not: user.id } }, select: { id: true } });
    await this.atividade.criar(todos.map((u) => u.id), 'VOTACAO_RESULTADO', { votacaoId: id, postId: post.id });
    return this.json({ ...v, encerradaEm: new Date() }, null, true, resultado);
  }

  private async buscar(id: string) {
    const v = UUID.test(id) ? await this.prisma.votacao.findUnique({ where: { id } }) : null;
    if (!v) throw naoEncontrado();
    return v;
  }

  private async exigirOpcoes(tipo: VotacaoTipo, ids: string[]) {
    const uuids = tipo !== 'CLUBE';
    if (uuids && !ids.every((i) => UUID.test(i))) throw invalido('Há opção que não existe.', 'opcoes');
    const achados =
      tipo === 'CLUBE' ? await this.prisma.club.count({ where: { id: { in: ids }, oficial: false } })
      : tipo === 'TECNICO' ? await this.prisma.club.count({ where: { coachId: { in: ids } } })
      : await this.prisma.post.count({ where: { id: { in: ids }, hiddenAt: null } });
    if (achados !== ids.length) throw invalido(tipo === 'TECNICO' ? 'Toda opção precisa ser um técnico atual.' : 'Há opção que não existe.', 'opcoes');
  }

  /** Clube que recebe o selo: o próprio clube, o clube que o técnico comanda hoje, ou o clube do post. */
  private async clubeDe(tx: Pick<PrismaService, 'club' | 'post'>, tipo: VotacaoTipo, opcao: string) {
    if (tipo === 'CLUBE') return opcao;
    if (tipo === 'TECNICO') return (await tx.club.findUnique({ where: { coachId: opcao }, select: { id: true } }))?.id ?? null;
    return (await tx.post.findFirst({ where: { id: opcao, hiddenAt: null }, select: { clubId: true } }))?.clubId ?? null; // post ocultado não ganha selo
  }

  private async rotulos(v: Votacao) {
    const ids = v.opcoes as string[];
    const nomes = new Map<string, string>();
    if (v.tipo === 'CLUBE') (await this.prisma.club.findMany({ where: { id: { in: ids } } })).forEach((c) => nomes.set(c.id, c.name));
    else if (v.tipo === 'TECNICO') (await this.prisma.user.findMany({ where: { id: { in: ids } } })).forEach((u) => nomes.set(u.id, u.name));
    else (await this.prisma.post.findMany({ where: { id: { in: ids }, hiddenAt: null } })).forEach((p) => nomes.set(p.id, curto(p.texto ?? (p.caption || 'Post sem legenda'), 60)));
    return ids.map((id) => ({ id, rotulo: nomes.get(id) ?? (v.tipo === 'POST' ? 'Post indisponível' : id) }));
  }

  private async apurar(tx: Pick<PrismaService, 'voto'>, v: Votacao) {
    const por = await tx.voto.groupBy({ by: ['opcao'], where: { votacaoId: v.id }, _count: { _all: true } });
    const rot = new Map((await this.rotulos(v)).map((o) => [o.id, o.rotulo]));
    return (v.opcoes as string[])
      .map((opcao) => ({ opcao, rotulo: rot.get(opcao) ?? opcao, votos: por.find((p) => p.opcao === opcao)?._count._all ?? 0 }))
      .sort((a, b) => b.votos - a.votos); // empate mantém a ordem original (sort estável)
  }

  /** `resultado` só sai com a votação encerrada: até lá a contagem nunca sobe para a API. */
  private async json(v: Votacao, meuVoto: string | null, comResultado: boolean, resultado?: { opcao: string; rotulo: string; votos: number }[]) {
    return {
      id: v.id,
      titulo: v.titulo,
      tipo: v.tipo,
      prazo: v.prazo,
      aberta: v.encerradaEm === null && v.prazo.getTime() > Date.now(),
      encerrada: v.encerradaEm !== null,
      opcoes: await this.rotulos(v),
      meuVoto,
      ...(comResultado ? { resultado: resultado ?? (await this.apurar(this.prisma, v)) } : {}),
    };
  }
}
