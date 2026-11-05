import { Injectable, Logger } from '@nestjs/common';
import type { UserComClube } from '../auth/auth.service.js';
import { montarResumo } from '../bot/zoeira.js';
import { ApiError } from '../http.js';
import { UUID } from '../posts/cursor.js';
import { BolaoService } from '../bolao/bolao.service.js';
import { AtividadeService } from '../atividade/atividade.service.js';
import { PostsService } from '../posts/posts.service.js';
import { PrismaService } from '../prisma.service.js';
import { PushService } from '../push/push.service.js';
import { gols, MAX_GOLS } from './gols.js';
import { LigaEventos } from './liga.eventos.js';
import { calcularTabela, type JogoFechado, type Linha } from './tabela.js';

const RODADAS = 38;
const jaPublicado = () => new ApiError(409, 'RESUMO_JA_PUBLICADO', 'O resumo desta rodada já foi publicado.');
const invalido = (msg: string, campo = 'jogos') => new ApiError(400, 'DADOS_INVALIDOS', msg, [campo]);
const clubeMini = (c: { id: string; name: string; crestPath: string }) => ({ id: c.id, nome: c.name, escudoUrl: c.crestPath });

const paraFechado = (j: { rodadaNumero: number; mandanteId: string; visitanteId: string; golsMandante: number | null; golsVisitante: number | null }) => ({ rodada: j.rodadaNumero, mandanteId: j.mandanteId, visitanteId: j.visitanteId, golsMandante: j.golsMandante, golsVisitante: j.golsVisitante });
const apareceInteiro = (nome: string, texto: string) => new RegExp(`(?<![\\p{L}\\p{N}])${nome.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}\\p{N}])`, 'iu').test(texto);
type JogoEntrada = { mandanteId: string; visitanteId: string; golsMandante: number | null; golsVisitante: number | null };
const comPlacar = (j: { golsMandante: unknown }) => j.golsMandante !== null;

/** `{prazoPalpite: ISO | null}`. Exportada: a Copa usa a mesma regra. */
export function lerPrazo(corpo: unknown): Date | null {
  const v = typeof corpo === 'object' && corpo ? (corpo as { prazoPalpite?: unknown }).prazoPalpite : undefined;
  if (v === null) return null;
  const d = typeof v === 'string' ? new Date(v) : null;
  if (!d || Number.isNaN(d.getTime())) throw invalido('prazoPalpite precisa ser uma data ISO (ou null para tirar o prazo).', 'prazoPalpite');
  return d;
}

@Injectable()
export class LigaService {
  private readonly logger = new Logger(LigaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventos: LigaEventos,
    private readonly posts: PostsService,
    private readonly push: PushService,
    private readonly atividade: AtividadeService,
    private readonly bolao: BolaoService,
  ) {}

  /** Calculada a cada pedido, só com jogos de rodadas fechadas: nada fica guardado em duplicidade. */
  async tabela(rodadas: { lt?: number; lte?: number } = {}): Promise<Linha[]> {
    const [clubes, jogos] = await Promise.all([
      this.prisma.club.findMany({ where: { oficial: false }, select: { id: true, name: true } }),
      this.prisma.jogo.findMany({ where: { rodada: { fechadaEm: { not: null }, numero: rodadas } } }),
    ]);
    return calcularTabela(
      clubes.map((c) => ({ id: c.id, nome: c.name })),
      jogos.map(paraFechado),
    );
  }

  /** Prévia do post do bot: só de rodada fechada. Não grava nada; sortear de novo = chamar de novo. */
  async previa(n: number) {
    await this.exigirFechada(n);
    const [jogos, antes, depois, clubes, rei] = await Promise.all([
      this.prisma.jogo.findMany({ where: { rodadaNumero: n } }),
      this.tabela({ lt: n }),
      this.tabela({ lte: n }),
      this.prisma.club.findMany({ where: { coach: { isNot: null } }, include: { coach: { select: { id: true, name: true } } } }),
      this.bolao.reiDaRodada(n),
    ]);
    const tecnicos = Object.fromEntries(clubes.map((c) => [c.id, { id: c.coach!.id, nome: c.coach!.name }]));
    return montarResumo({ numero: n, jogos: jogos.filter(comPlacar).map(paraFechado) as JogoFechado[], antes, depois, tecnicos, rei });
  }

  /**
   * Publica o texto (já editado pelo admin) como post de texto da CBF. Push: todos recebem "CBF / Saiu o resumo da rodada N"
   * (sem o nome do admin) exceto os citados, que recebem só "A CBF citou você". `citados` são os ids devolvidos pela prévia;
   * valem os que são técnicos de clubes da rodada e cujo nome ainda aparece, como palavra inteira, no texto final.
   */
  async publicar(user: UserComClube, n: number, corpo: unknown) {
    const { texto, citados: bruto } = (typeof corpo === 'object' && corpo ? corpo : {}) as { texto?: unknown; citados?: unknown };
    if (bruto !== undefined && !Array.isArray(bruto)) throw new ApiError(400, 'DADOS_INVALIDOS', 'citados precisa ser uma lista de ids.', ['citados']);
    await this.exigirFechada(n, true);
    const criado = await this.posts.criar(user, { comoCbf: true, texto }, [], [], false);
    // reserva a vaga do resumo; quem perdeu a corrida desfaz o seu post (sem push)
    const { count } = await this.prisma.rodada.updateMany({ where: { numero: n, resumoPostId: null }, data: { resumoPostId: criado.id } });
    if (count === 0) {
      await this.prisma.post.delete({ where: { id: criado.id } });
      throw jaPublicado();
    }
    const pedidos = new Set((bruto ?? []).filter((x): x is string => typeof x === 'string' && UUID.test(x)));
    const clubes = pedidos.size
      ? await this.prisma.club.findMany({
          where: { coachId: { in: [...pedidos] }, OR: [{ mandante: { some: { rodadaNumero: n } } }, { visitante: { some: { rodadaNumero: n } } }] },
          include: { coach: { select: { id: true, name: true } } },
        })
      : [];
    const citados = clubes.filter((c) => c.coach!.id !== user.id && apareceInteiro(c.coach!.name, criado.texto ?? '')).map((c) => c.coach!.id);
    const todos = await this.prisma.user.findMany({ where: { id: { notIn: [user.id, ...citados] } }, select: { id: true } });
    void this.push.enviar(todos.map((u) => u.id), { titulo: 'CBF', corpo: `Saiu o resumo da rodada ${n}`, url: `/p/${criado.id}` }, 'cbf');
    void this.atividade.criar(citados, 'CBF_CITOU', { postId: criado.id }).catch((e: unknown) => this.logger.warn(`atividade CBF_CITOU: ${String(e)}`));
    if (citados.length) void this.push.enviar(citados, { titulo: 'A CBF citou você', corpo: (criado.texto ?? '').slice(0, 80), url: `/p/${criado.id}` }, 'cbf');
    return criado;
  }

  private async exigirFechada(n: number, publicar = false) {
    const r = Number.isInteger(n) ? await this.prisma.rodada.findUnique({ where: { numero: n } }) : null;
    if (!r) throw new ApiError(404, 'NAO_ENCONTRADO', 'Rodada não encontrada.');
    if (!r.fechadaEm) throw new ApiError(409, 'RODADA_ABERTA', 'Feche a rodada antes de gerar ou publicar o resumo.');
    if (publicar && r.resumoPostId) throw jaPublicado();
  }

  async rodadas() {
    const lista = await this.prisma.rodada.findMany({
      orderBy: { numero: 'asc' },
      include: { jogos: { include: { mandante: true, visitante: true }, orderBy: { id: 'asc' } } },
    });
    return lista.map((r) => ({
      numero: r.numero,
      fechada: r.fechadaEm !== null,
      resumoPublicado: r.resumoPostId !== null,
      resumoPostId: r.resumoPostId,
      prazoPalpite: r.prazoPalpite,
      jogos: r.jogos.map((j) => ({ id: j.id, mandante: clubeMini(j.mandante), visitante: clubeMini(j.visitante), golsMandante: j.golsMandante, golsVisitante: j.golsVisitante })),
    }));
  }

  /** Posição e últimos resultados de um clube (null para a CBF e outros oficiais). */
  async doClube(id: string) {
    const l = (await this.tabela()).find((x) => x.clubeId === id);
    return l ? { posicao: l.posicao, ultimos: l.ultimos, pontos: l.P, jogos: l.J } : null;
  }

  /** Substitui todos os jogos da rodada (só aberta). Valida tudo antes de gravar: ou entra tudo ou nada. */
  async lancarJogos(n: number, corpo: unknown) {
    const jogos = this.lerJogos(corpo);
    await this.prisma.$transaction(async (tx) => {
      await this.travar(tx, n);
      const ids = [...new Set(jogos.flatMap((j) => [j.mandanteId, j.visitanteId]))];
      const achados = await tx.club.findMany({ where: { id: { in: ids }, oficial: false }, select: { id: true } });
      if (achados.length !== ids.length) throw invalido('Há clube inexistente (ou a CBF) nos jogos.');
      // mesmo confronto = mesmo jogo (atualiza o placar): os palpites do bolão não se perdem ao lançar resultado
      const chave = (j: { mandanteId: string; visitanteId: string }) => `${j.mandanteId}|${j.visitanteId}`;
      const antigos = await tx.jogo.findMany({ where: { rodadaNumero: n } });
      const novos = new Set(jogos.map(chave));
      await tx.jogo.deleteMany({ where: { id: { in: antigos.filter((a) => !novos.has(chave(a))).map((a) => a.id) } } });
      const existente = new Map(antigos.map((a) => [chave(a), a.id]));
      for (const j of jogos) {
        const id = existente.get(chave(j));
        if (id) await tx.jogo.update({ where: { id }, data: { golsMandante: j.golsMandante, golsVisitante: j.golsVisitante } });
        else await tx.jogo.create({ data: { ...j, rodadaNumero: n } });
      }
    });
  }

  async fechar(n: number) {
    await this.prisma.$transaction(async (tx) => {
      await this.travar(tx, n); // recusa rodada inexistente (404) ou já fechada (409)
      if (await tx.jogo.count({ where: { rodadaNumero: n, golsMandante: null } })) throw new ApiError(409, 'PLACAR_PENDENTE', 'Há jogo sem placar nesta rodada. Lance todos os placares antes de fechar.');
      await tx.rodada.update({ where: { numero: n }, data: { fechadaEm: new Date() } });
    });
    this.eventos.emit('liga.rodadaFechada', n);
  }

  /** Prazo do palpite da rodada (ISO ou null para tirar). */
  async definirPrazo(n: number, corpo: unknown) {
    const prazo = lerPrazo(corpo);
    if (!Number.isInteger(n)) throw new ApiError(404, 'NAO_ENCONTRADO', 'Rodada não encontrada.');
    const { count } = await this.prisma.rodada.updateMany({ where: { numero: n }, data: { prazoPalpite: prazo } });
    if (count === 0) throw new ApiError(404, 'NAO_ENCONTRADO', 'Rodada não encontrada.');
  }

  /** Próximos jogos sem placar (Brasileirão de rodada aberta + Copa de fase aberta), por prazo e depois por rodada/fase. */
  async calendario() {
    const [rodadas, fases] = await Promise.all([
      this.prisma.rodada.findMany({ where: { fechadaEm: null, jogos: { some: { golsMandante: null } } }, include: { jogos: { where: { golsMandante: null }, include: { mandante: true, visitante: true }, orderBy: { id: 'asc' } } } }),
      this.prisma.copaFase.findMany({ where: { fechadaEm: null }, include: { jogos: { where: { golsMandante: null }, include: { mandante: true, visitante: true }, orderBy: { id: 'asc' } } } }),
    ]);
    const itens = [
      ...rodadas.flatMap((r) => r.jogos.map((j) => ({ ord: r.numero, prazoPalpite: r.prazoPalpite, tipo: 'BRASILEIRAO' as const, id: j.id, rodada: r.numero, fase: null, mandante: clubeMini(j.mandante), visitante: clubeMini(j.visitante) }))),
      ...fases.flatMap((f) => f.jogos.map((j) => ({ ord: f.ordem, prazoPalpite: f.prazoPalpite, tipo: 'COPA' as const, id: j.id, rodada: null, fase: { id: f.id, nome: f.nome }, mandante: clubeMini(j.mandante), visitante: clubeMini(j.visitante) }))),
    ];
    const t = (d: Date | null) => d?.getTime() ?? Infinity;
    return itens.sort((a, b) => t(a.prazoPalpite) - t(b.prazoPalpite) || a.ord - b.ord).map(({ ord: _ord, ...i }) => i);
  }

  async reabrir(n: number) {
    const { count } = await this.prisma.rodada.updateMany({ where: { numero: n, fechadaEm: { not: null } }, data: { fechadaEm: null } });
    if (count === 0) {
      if (!(await this.prisma.rodada.findUnique({ where: { numero: n } }))) throw new ApiError(404, 'NAO_ENCONTRADO', 'Rodada não encontrada.');
      throw new ApiError(409, 'RODADA_ABERTA', 'Esta rodada já está aberta.');
    }
  }

  /** Trava a linha da rodada (FOR UPDATE): lançar jogos e fechar ao mesmo tempo não se atropelam. Só segue se estiver aberta. */
  private async travar(tx: Pick<PrismaService, '$queryRaw'>, n: number) {
    if (!Number.isInteger(n) || n < 1 || n > RODADAS) throw new ApiError(404, 'NAO_ENCONTRADO', 'Rodada não encontrada.');
    const [r] = await tx.$queryRaw<{ fechadaEm: Date | null }[]>`SELECT "fechadaEm" FROM "Rodada" WHERE "numero" = ${n} FOR UPDATE`;
    if (!r) throw new ApiError(404, 'NAO_ENCONTRADO', 'Rodada não encontrada.');
    if (r.fechadaEm) throw new ApiError(409, 'RODADA_FECHADA', 'Esta rodada está fechada. Reabra para mudar.');
  }

  private lerJogos(corpo: unknown): JogoEntrada[] {
    const lista = typeof corpo === 'object' && corpo ? (corpo as { jogos?: unknown }).jogos : undefined;
    if (!Array.isArray(lista) || lista.length > 10) throw invalido('Envie `jogos`: uma lista de até 10 jogos.');
    const vistos = new Set<string>();
    return lista.map((j: Record<string, unknown> | null) => {
      const { mandanteId, visitanteId, golsMandante, golsVisitante } = j ?? {};
      if (typeof mandanteId !== 'string' || typeof visitanteId !== 'string' || !mandanteId || !visitanteId) throw invalido('Cada jogo precisa de mandanteId e visitanteId.');
      if (mandanteId === visitanteId) throw invalido('Um clube não joga contra si mesmo.');
      const agendado = (golsMandante ?? null) === null && (golsVisitante ?? null) === null; // jogo agendado: sem placar
      if (!agendado && (!gols(golsMandante) || !gols(golsVisitante))) throw invalido(`O placar vai de 0 a ${MAX_GOLS}, em números inteiros, ou nulo nos dois lados (jogo agendado).`);
      for (const id of [mandanteId, visitanteId]) {
        if (vistos.has(id)) throw invalido('Cada clube joga no máximo uma vez por rodada.');
        vistos.add(id);
      }
      return { mandanteId, visitanteId, golsMandante: agendado ? null : (golsMandante as number), golsVisitante: agendado ? null : (golsVisitante as number) };
    });
  }
}
