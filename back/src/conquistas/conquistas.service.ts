import { Injectable, Logger } from '@nestjs/common';
import { AtividadeService } from '../atividade/atividade.service.js';
import { BolaoService } from '../bolao/bolao.service.js';
import { ladoVencedor } from '../copa/copa.js';
import type { ConquistaTipo } from '../generated/prisma/client.js';
import { calcularTabela } from '../liga/tabela.js';
import { PostsService } from '../posts/posts.service.js';
import { PrismaService } from '../prisma.service.js';
import { PushService } from '../push/push.service.js';
import { goleada, invicto5, NOMES, primeiraVitoria, type JogoDoTecnico } from './regras.js';
import { nivelDe, xpDe, type Historico } from './xp.js';

/** Marca de que o histórico já foi gravado em silêncio (primeira execução, no deploy). */
export const SEMEADA = 'conquistas.semeadas';

type Devida = { userId: string; tipo: ConquistaTipo; refId: string };
type Tenure = { clubId: string; userId: string; startedAt: Date; endedAt: Date | null };
const chave = (d: Devida) => `${d.userId}|${d.tipo}|${d.refId}`;
/** Quem comandava o clube no instante `t` (início incluso, fim excluso). */
const donoEm = (tenures: Tenure[], clubId: string, t: Date) => tenures.find((x) => x.clubId === clubId && x.startedAt <= t && (x.endedAt === null || t < x.endedAt))?.userId;
const tecnicoNoMomento = (x: Tenure, t: Date) => x.startedAt <= t && (x.endedAt === null || t < x.endedAt);

@Injectable()
export class ConquistasService {
  private readonly logger = new Logger(ConquistasService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly atividade: AtividadeService,
    private readonly push: PushService,
    private readonly posts: PostsService,
    private readonly bolao: BolaoService,
  ) {}

  /**
   * Tudo que conta para o XP e para as regras de jogo, calculado na hora. Só entra jogo de rodada/fase fechada, e o resultado é do técnico
   * cujo `CoachTenure` cobria o `fechadaEm`. `exatosPorUsuario` evita reler os palpites a cada pessoa.
   */
  async historico(userId: string, exatosPorUsuario?: Map<string, number>): Promise<{ hist: Historico; jogosPorClube: Map<string, JogoDoTecnico[]> }> {
    const tenures = await this.prisma.coachTenure.findMany({ where: { userId } });
    const clubIds = [...new Set(tenures.map((t) => t.clubId))];
    const meus = await this.prisma.post.findMany({ where: { authorId: userId, hiddenAt: null, club: { oficial: false } }, select: { id: true } });
    const [curtidas, jogos, copas] = await Promise.all([
      this.prisma.like.groupBy({ by: ['postId'], where: { postId: { in: meus.map((p) => p.id) }, userId: { not: userId } }, _count: { _all: true } }),
      this.prisma.jogo.findMany({ where: { OR: [{ mandanteId: { in: clubIds } }, { visitanteId: { in: clubIds } }], golsMandante: { not: null }, rodada: { fechadaEm: { not: null } } }, include: { rodada: { select: { fechadaEm: true } } } }),
      this.prisma.copaJogo.findMany({ where: { OR: [{ mandanteId: { in: clubIds } }, { visitanteId: { in: clubIds } }], golsMandante: { not: null }, fase: { fechadaEm: { not: null } } }, include: { fase: { select: { fechadaEm: true } } } }),
    ]);

    const jogosPorClube = new Map<string, JogoDoTecnico[]>();
    const somar = (clubId: string, j: JogoDoTecnico) => jogosPorClube.set(clubId, [...(jogosPorClube.get(clubId) ?? []), j]);
    for (const j of jogos) {
      const quando = j.rodada.fechadaEm!;
      for (const [clubId, pro, contra] of [[j.mandanteId, j.golsMandante!, j.golsVisitante!], [j.visitanteId, j.golsVisitante!, j.golsMandante!]] as const)
        if (tenures.some((t) => t.clubId === clubId && tecnicoNoMomento(t, quando))) somar(clubId, { data: quando, rodada: j.rodadaNumero, golsPro: pro, golsContra: contra });
    }
    for (const j of copas) {
      const quando = j.fase.fechadaEm!;
      const empate = j.golsMandante === j.golsVisitante; // pênaltis decidem quem passa, mas o jogo conta como empate
      for (const [clubId, pro, contra] of [[j.mandanteId, j.golsMandante!, j.golsVisitante!], [j.visitanteId, j.golsVisitante!, j.golsMandante!]] as const)
        if (tenures.some((t) => t.clubId === clubId && tecnicoNoMomento(t, quando))) somar(clubId, { data: quando, rodada: null, golsPro: pro, golsContra: contra, penaltis: empate });
    }
    const todos = [...jogosPorClube.values()].flat();
    const exatos = (exatosPorUsuario ?? (await this.exatos())).get(userId) ?? 0;
    const hist: Historico = {
      posts: meus.length,
      reacoesPorPost: curtidas.map((c) => c._count._all),
      vitorias: todos.filter((j) => j.golsPro > j.golsContra).length,
      empates: todos.filter((j) => j.golsPro === j.golsContra).length,
      exatos,
    };
    return { hist, jogosPorClube };
  }

  async nivel(userId: string) {
    return nivelDe(xpDe((await this.historico(userId)).hist));
  }

  async listar(userId: string) {
    const grupos = await this.prisma.conquista.groupBy({ by: ['tipo'], where: { userId }, _count: { _all: true }, _max: { criadaEm: true } });
    return grupos
      .map((g) => ({ tipo: g.tipo, nome: NOMES[g.tipo], vezes: g._count._all, ultimaEm: g._max.criadaEm! }))
      .sort((a, b) => b.ultimaEm.getTime() - a.ultimaEm.getTime() || a.tipo.localeCompare(b.tipo));
  }

  /**
   * Recalcula as condições e grava só as conquistas que faltam; as realmente novas são anunciadas (atividade, push `cbf` e post da CBF).
   * Conquista dada não é retirada. Na primeira execução (sem a marca `conquistas.semeadas`) grava tudo em silêncio e põe a marca.
   */
  async verificar(userIds?: string[]): Promise<void> {
    const primeira = !(await this.prisma.setting.findUnique({ where: { key: SEMEADA } }));
    const alvo = primeira ? undefined : userIds;
    const ids = alvo ?? (await this.prisma.user.findMany({ select: { id: true } })).map((u) => u.id);
    const so = new Set(ids);
    const exatos = await this.exatos();

    const devidas = new Map<string, Devida>();
    const add = (userId: string | undefined, tipo: ConquistaTipo, refId = '') => {
      if (userId && so.has(userId)) devidas.set(chave({ userId, tipo, refId }), { userId, tipo, refId });
    };
    for (const userId of ids) {
      const { hist, jogosPorClube } = await this.historico(userId, exatos);
      const todos = [...jogosPorClube.values()].flat();
      if (primeiraVitoria(todos)) add(userId, 'PRIMEIRA_VITORIA');
      if (goleada(todos)) add(userId, 'GOLEADA');
      if ([...jogosPorClube.values()].some(invicto5)) add(userId, 'INVICTO_5');
      if (hist.posts >= 100) add(userId, 'COMUNICADOR');
      if (await this.prisma.story.count({ where: { autorId: userId } })) add(userId, 'PRIMEIRO_STORY');
    }
    await this.globais(add);

    const existentes = new Set((await this.prisma.conquista.findMany({ where: { userId: { in: ids } }, select: { userId: true, tipo: true, refId: true } })).map(chave));
    const novas: Devida[] = [];
    for (const d of devidas.values()) {
      if (existentes.has(chave(d))) continue;
      // uma por vez: com dois `verificar` ao mesmo tempo, só quem de fato gravou (count 1) anuncia
      const { count } = await this.prisma.conquista.createMany({ data: [d], skipDuplicates: true });
      if (count === 1) novas.push(d);
    }
    if (primeira) await this.prisma.setting.upsert({ where: { key: SEMEADA }, update: {}, create: { key: SEMEADA, value: new Date().toISOString() } });
    else for (const d of novas) await this.anunciar(d).catch((e: unknown) => this.logger.error(`anunciar ${d.tipo}: ${String(e)}`));
  }

  private async exatos() {
    return new Map((await this.bolao.ranking()).map((l) => [l.usuario.id, l.exatos]));
  }

  /** Conquistas que dependem da tabela, da Copa e do bolão (de todo mundo): líder, campeão da Copa e rei do bolão. */
  private async globais(add: (userId: string | undefined, tipo: ConquistaTipo, refId?: string) => void) {
    const [tenures, clubes, rodadas, fases] = await Promise.all([
      this.prisma.coachTenure.findMany(),
      this.prisma.club.findMany({ where: { oficial: false }, select: { id: true, name: true } }),
      this.prisma.rodada.findMany({ where: { fechadaEm: { not: null } }, orderBy: { numero: 'asc' }, include: { jogos: true } }),
      this.prisma.copaFase.findMany({ where: { fechadaEm: { not: null } }, orderBy: { ordem: 'asc' }, include: { jogos: true } }),
    ]);

    // líder: quem fecha a rodada em 1º (tabela só com rodadas fechadas, até ela)
    const fechados = rodadas.flatMap((r) => r.jogos.map((j) => ({ rodada: r.numero, mandanteId: j.mandanteId, visitanteId: j.visitanteId, golsMandante: j.golsMandante, golsVisitante: j.golsVisitante })));
    for (const r of rodadas) {
      const lider = calcularTabela(clubes.map((c) => ({ id: c.id, nome: c.name })), fechados.filter((j) => j.rodada <= r.numero))[0];
      if (lider?.J) add(donoEm(tenures, lider.clubeId, r.fechadaEm!), 'LIDER');
    }

    // campeão da Copa: o vencedor do jogo da fase fechada de maior `ordem` que tem um jogo só
    const final = fases.filter((f) => f.jogos.length === 1).at(-1);
    const jogoFinal = final?.jogos[0];
    const lado = jogoFinal && ladoVencedor(jogoFinal);
    if (final && jogoFinal && lado) add(donoEm(tenures, lado === 'M' ? jogoFinal.mandanteId : jogoFinal.visitanteId, final.fechadaEm!), 'CAMPEAO_COPA');

    // rei do bolão: maior pontuação (> 0) de uma rodada ou fase fechada; empate dá para todos
    const reis = async (escopo: { jogo: object } | { copaJogo: object }, refId: string) => {
      const r = await this.bolao.ranking(escopo);
      for (const l of r.filter((x) => x.pontos > 0 && x.pontos === r[0].pontos)) add(l.usuario.id, 'REI_BOLAO', refId);
    };
    for (const r of rodadas) if (r.jogos.length) await reis({ jogo: { rodadaNumero: r.numero } }, `r${r.numero}`);
    for (const f of fases) await reis({ copaJogo: { faseId: f.id } }, f.id);
  }

  private async anunciar(d: Devida) {
    const nome = NOMES[d.tipo];
    const u = await this.prisma.user.findUnique({ where: { id: d.userId }, select: { name: true } });
    if (!u) return;
    await this.atividade.criar([d.userId], 'CONQUISTA', { conquistaTipo: d.tipo });
    void this.push.enviar([d.userId], { titulo: 'Conquista nova', corpo: nome, url: `/u/${d.userId}` }, 'cbf');
    const admin = await this.prisma.user.findFirst({ where: { isAdmin: true }, include: { club: true }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
    if (admin) await this.posts.criar(admin, { comoCbf: true, texto: `🏆 @[${u.name.replace(/[\]\n]/g, '')}](${d.userId}) conquistou ${nome}!` }, [], [], false);
  }
}
