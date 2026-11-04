import { Injectable } from '@nestjs/common';
import type { UserComClube } from '../auth/auth.service.js';
import { montarResumo } from '../bot/zoeira.js';
import { ApiError } from '../http.js';
import { UUID } from '../posts/cursor.js';
import { PostsService } from '../posts/posts.service.js';
import { PrismaService } from '../prisma.service.js';
import { PushService } from '../push/push.service.js';
import { LigaEventos } from './liga.eventos.js';
import { calcularTabela, type Linha } from './tabela.js';

const RODADAS = 38;
const MAX_GOLS = 99;
const invalido = (msg: string, campo = 'jogos') => new ApiError(400, 'DADOS_INVALIDOS', msg, [campo]);
const clubeMini = (c: { id: string; name: string; crestPath: string }) => ({ id: c.id, nome: c.name, escudoUrl: c.crestPath });
const gols = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= MAX_GOLS;

const paraFechado = (j: { rodadaNumero: number; mandanteId: string; visitanteId: string; golsMandante: number; golsVisitante: number }) => ({ rodada: j.rodadaNumero, mandanteId: j.mandanteId, visitanteId: j.visitanteId, golsMandante: j.golsMandante, golsVisitante: j.golsVisitante });
const apareceInteiro = (nome: string, texto: string) => new RegExp(`(?<![\\p{L}\\p{N}])${nome.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}\\p{N}])`, 'iu').test(texto);
type JogoEntrada = { mandanteId: string; visitanteId: string; golsMandante: number; golsVisitante: number };

@Injectable()
export class LigaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventos: LigaEventos,
    private readonly posts: PostsService,
    private readonly push: PushService,
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
    const [jogos, antes, depois, clubes] = await Promise.all([
      this.prisma.jogo.findMany({ where: { rodadaNumero: n } }),
      this.tabela({ lt: n }),
      this.tabela({ lte: n }),
      this.prisma.club.findMany({ where: { coach: { isNot: null } }, include: { coach: { select: { id: true, name: true } } } }),
    ]);
    const tecnicos = Object.fromEntries(clubes.map((c) => [c.id, { id: c.coach!.id, nome: c.coach!.name }]));
    return montarResumo({ numero: n, jogos: jogos.map(paraFechado), antes, depois, tecnicos });
  }

  /**
   * Publica o texto (já editado pelo admin) como post de texto da CBF. Push: todos recebem "CBF / Saiu o resumo da rodada N"
   * (sem o nome do admin) exceto os citados, que recebem só "A CBF citou você". `citados` são os ids devolvidos pela prévia;
   * valem os que são técnicos de clubes da rodada e cujo nome ainda aparece, como palavra inteira, no texto final.
   */
  async publicar(user: UserComClube, n: number, corpo: unknown) {
    const { texto, citados: bruto } = (typeof corpo === 'object' && corpo ? corpo : {}) as { texto?: unknown; citados?: unknown };
    if (bruto !== undefined && !Array.isArray(bruto)) throw new ApiError(400, 'DADOS_INVALIDOS', 'citados precisa ser uma lista de ids.', ['citados']);
    await this.exigirFechada(n);
    const criado = await this.posts.criar(user, { comoCbf: true, texto }, [], [], false);
    const pedidos = new Set((bruto ?? []).filter((x): x is string => typeof x === 'string' && UUID.test(x)));
    const clubes = pedidos.size
      ? await this.prisma.club.findMany({
          where: { coachId: { in: [...pedidos] }, OR: [{ mandante: { some: { rodadaNumero: n } } }, { visitante: { some: { rodadaNumero: n } } }] },
          include: { coach: { select: { id: true, name: true } } },
        })
      : [];
    const citados = clubes.filter((c) => c.coach!.id !== user.id && apareceInteiro(c.coach!.name, criado.texto ?? '')).map((c) => c.coach!.id);
    const todos = await this.prisma.user.findMany({ where: { id: { notIn: [user.id, ...citados] } }, select: { id: true } });
    void this.push.enviar(todos.map((u) => u.id), { titulo: 'CBF', corpo: `Saiu o resumo da rodada ${n}`, url: `/p/${criado.id}` });
    if (citados.length) void this.push.enviar(citados, { titulo: 'A CBF citou você', corpo: (criado.texto ?? '').slice(0, 80), url: `/p/${criado.id}` });
    return criado;
  }

  private async exigirFechada(n: number) {
    const r = Number.isInteger(n) ? await this.prisma.rodada.findUnique({ where: { numero: n } }) : null;
    if (!r) throw new ApiError(404, 'NAO_ENCONTRADO', 'Rodada não encontrada.');
    if (!r.fechadaEm) throw new ApiError(409, 'RODADA_ABERTA', 'Feche a rodada antes de gerar ou publicar o resumo.');
  }

  async rodadas() {
    const lista = await this.prisma.rodada.findMany({
      orderBy: { numero: 'asc' },
      include: { jogos: { include: { mandante: true, visitante: true }, orderBy: { id: 'asc' } } },
    });
    return lista.map((r) => ({
      numero: r.numero,
      fechada: r.fechadaEm !== null,
      jogos: r.jogos.map((j) => ({ id: j.id, mandante: clubeMini(j.mandante), visitante: clubeMini(j.visitante), golsMandante: j.golsMandante, golsVisitante: j.golsVisitante })),
    }));
  }

  /** Posição e últimos resultados de um clube (null para a CBF e outros oficiais). */
  async doClube(id: string) {
    const l = (await this.tabela()).find((x) => x.clubeId === id);
    return l ? { posicao: l.posicao, ultimos: l.ultimos } : null;
  }

  /** Substitui todos os jogos da rodada (só aberta). Valida tudo antes de gravar: ou entra tudo ou nada. */
  async lancarJogos(n: number, corpo: unknown) {
    const jogos = this.lerJogos(corpo);
    await this.prisma.$transaction(async (tx) => {
      await this.travar(tx, n);
      const ids = [...new Set(jogos.flatMap((j) => [j.mandanteId, j.visitanteId]))];
      const achados = await tx.club.findMany({ where: { id: { in: ids }, oficial: false }, select: { id: true } });
      if (achados.length !== ids.length) throw invalido('Há clube inexistente (ou a CBF) nos jogos.');
      await tx.jogo.deleteMany({ where: { rodadaNumero: n } });
      await tx.jogo.createMany({ data: jogos.map((j) => ({ ...j, rodadaNumero: n })) });
    });
  }

  async fechar(n: number) {
    await this.prisma.$transaction(async (tx) => {
      await this.travar(tx, n); // recusa rodada inexistente (404) ou já fechada (409)
      await tx.rodada.update({ where: { numero: n }, data: { fechadaEm: new Date() } });
    });
    this.eventos.emit('liga.rodadaFechada', n);
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
      if (!gols(golsMandante) || !gols(golsVisitante)) throw invalido(`O placar vai de 0 a ${MAX_GOLS}, em números inteiros.`);
      for (const id of [mandanteId, visitanteId]) {
        if (vistos.has(id)) throw invalido('Cada clube joga no máximo uma vez por rodada.');
        vistos.add(id);
      }
      return { mandanteId, visitanteId, golsMandante, golsVisitante };
    });
  }
}
