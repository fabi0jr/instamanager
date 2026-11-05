import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import type { UserComClube } from '../auth/auth.service.js';
import { BolaoService } from '../bolao/bolao.service.js';
import { AtividadeService } from '../atividade/atividade.service.js';
import { montarResumoCopa } from '../bot/zoeira.js';
import { ApiError } from '../http.js';
import { gols } from '../liga/gols.js';
import { lerPrazo } from '../liga/liga.service.js';
import { PostsService } from '../posts/posts.service.js';
import { UUID } from '../posts/cursor.js';
import { PrismaService } from '../prisma.service.js';
import { PushService } from '../push/push.service.js';
import { achaEliminadoJogando, ladoVencedor, type PlacarCopa } from './copa.js';
import { CopaEventos } from './copa.eventos.js';

const MAX_JOGOS = 10; // 20 clubes
const invalido = (msg: string, campo = 'jogos') => new ApiError(400, 'DADOS_INVALIDOS', msg, [campo]);
const naoAchou = () => new ApiError(404, 'NAO_ENCONTRADO', 'Fase não encontrada.');
const clubeMini = (c: { id: string; name: string; crestPath: string }) => ({ id: c.id, nome: c.name, escudoUrl: c.crestPath });
type JogoEntrada = PlacarCopa & { mandanteId: string; visitanteId: string };
type Tx = Pick<PrismaService, '$queryRaw' | 'copaJogo' | 'copaFase'>;

@Injectable()
export class CopaService {
  private readonly logger = new Logger(CopaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly posts: PostsService,
    private readonly push: PushService,
    private readonly atividade: AtividadeService,
    private readonly bolao: BolaoService,
    private readonly eventos: CopaEventos,
  ) {}

  async chave() {
    const fases = await this.prisma.copaFase.findMany({
      orderBy: { ordem: 'asc' },
      include: { jogos: { include: { mandante: true, visitante: true }, orderBy: { id: 'asc' } } },
    });
    return fases.map((f) => ({
      fase: { id: f.id, nome: f.nome, ordem: f.ordem, prazoPalpite: f.prazoPalpite, fechada: f.fechadaEm !== null, resumoPublicado: f.resumoPostId !== null, resumoPostId: f.resumoPostId },
      jogos: f.jogos.map((j) => {
        const l = ladoVencedor(j);
        return {
          id: j.id,
          mandante: clubeMini(j.mandante),
          visitante: clubeMini(j.visitante),
          golsMandante: j.golsMandante,
          golsVisitante: j.golsVisitante,
          penaltisMandante: j.penaltisMandante,
          penaltisVisitante: j.penaltisVisitante,
          vencedor: l ? clubeMini(l === 'M' ? j.mandante : j.visitante) : null,
        };
      }),
    }));
  }

  async criarFase(corpo: unknown) {
    const { nome, ordem } = (typeof corpo === 'object' && corpo ? corpo : {}) as { nome?: unknown; ordem?: unknown };
    if (typeof nome !== 'string' || !nome.trim() || nome.trim().length > 60) throw invalido('nome: 1 a 60 caracteres.', 'nome');
    if (typeof ordem !== 'number' || !Number.isInteger(ordem) || ordem < 1 || ordem > 99) throw invalido('ordem: inteiro de 1 a 99.', 'ordem');
    // sem checar antes: duas criações ao mesmo tempo passariam do findUnique e a segunda estouraria no índice único
    try {
      const f = await this.prisma.copaFase.create({ data: { nome: nome.trim(), ordem } });
      return { id: f.id, nome: f.nome, ordem: f.ordem };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new ApiError(409, 'ORDEM_REPETIDA', 'Já existe uma fase com essa ordem.');
      throw e;
    }
  }

  /** Substitui todos os jogos da fase (só aberta). Valida tudo antes de gravar. */
  async lancarJogos(id: string, corpo: unknown) {
    const jogos = this.lerJogos(corpo);
    await this.prisma.$transaction(async (tx) => {
      await this.travar(tx, id);
      const ids = [...new Set(jogos.flatMap((j) => [j.mandanteId, j.visitanteId]))];
      const achados = await tx.club.findMany({ where: { id: { in: ids }, oficial: false }, select: { id: true } });
      if (achados.length !== ids.length) throw invalido('Há clube inexistente (ou a CBF) nos jogos.');
      // mesmo confronto = mesmo jogo (atualiza o placar): os palpites do bolão não se perdem ao lançar resultado
      const chave = (j: { mandanteId: string; visitanteId: string }) => `${j.mandanteId}|${j.visitanteId}`;
      const antigos = await tx.copaJogo.findMany({ where: { faseId: id } });
      const novos = new Set(jogos.map(chave));
      await tx.copaJogo.deleteMany({ where: { id: { in: antigos.filter((a) => !novos.has(chave(a))).map((a) => a.id) } } });
      const existente = new Map(antigos.map((a) => [chave(a), a.id]));
      for (const j of jogos) {
        const jid = existente.get(chave(j));
        if (jid) await tx.copaJogo.update({ where: { id: jid }, data: { golsMandante: j.golsMandante, golsVisitante: j.golsVisitante, penaltisMandante: j.penaltisMandante, penaltisVisitante: j.penaltisVisitante } });
        else await tx.copaJogo.create({ data: { ...j, faseId: id } });
      }
      // vale nos dois sentidos: quem perdeu antes não volta, e mudar o placar não pode eliminar quem já joga adiante
      const fases = await tx.copaFase.findMany({ orderBy: { ordem: 'asc' }, include: { jogos: true } });
      if (achaEliminadoJogando(fases)) throw new ApiError(409, 'CLUBE_ELIMINADO', 'Um clube eliminado não pode jogar uma fase mais adiante.');
    });
  }

  async definirPrazo(id: string, corpo: unknown) {
    const prazo = lerPrazo(corpo);
    if (!UUID.test(id)) throw naoAchou();
    const { count } = await this.prisma.copaFase.updateMany({ where: { id }, data: { prazoPalpite: prazo } });
    if (count === 0) throw naoAchou();
  }

  /** Fecha a fase (todos os placares lançados) e devolve a prévia do resumo do bot. Não publica. */
  async fechar(id: string) {
    const jogos = await this.prisma.$transaction(async (tx) => {
      const fase = await this.travar(tx, id);
      const js = await tx.copaJogo.findMany({ where: { faseId: id }, include: { mandante: true, visitante: true } });
      if (!js.length || js.some((j) => ladoVencedor(j) === null)) throw new ApiError(409, 'PLACAR_PENDENTE', 'Lance o placar de todos os jogos (com pênaltis nos empates) antes de fechar a fase.');
      await tx.copaFase.update({ where: { id }, data: { fechadaEm: new Date() } });
      return { fase, js };
    });
    this.eventos.emit('copa.faseFechada', id);
    return this.previaDe(jogos.fase.nome, jogos.js, await this.bolao.reiDaFase(id));
  }

  /** Prévia de novo (sorteia outra) para fase já fechada, publicada ou não. Não grava nada. */
  async previa(id: string) {
    const fase = UUID.test(id) ? await this.prisma.copaFase.findUnique({ where: { id }, include: { jogos: { include: { mandante: true, visitante: true } } } }) : null;
    if (!fase) throw naoAchou();
    if (!fase.fechadaEm) throw new ApiError(409, 'FASE_ABERTA', 'Feche a fase antes de gerar o resumo.');
    return this.previaDe(fase.nome, fase.jogos, await this.bolao.reiDaFase(id));
  }

  async reabrir(id: string) {
    if (!UUID.test(id)) throw naoAchou();
    const { count } = await this.prisma.copaFase.updateMany({ where: { id, fechadaEm: { not: null } }, data: { fechadaEm: null } });
    if (count === 0) {
      if (!(await this.prisma.copaFase.findUnique({ where: { id } }))) throw naoAchou();
      throw new ApiError(409, 'FASE_ABERTA', 'Esta fase já está aberta.');
    }
  }

  /** Mesmo contrato do resumo da rodada: texto já editado pelo admin, `citados` da prévia; um resumo por fase. */
  async publicar(user: UserComClube, id: string, corpo: unknown) {
    const { texto, citados: bruto } = (typeof corpo === 'object' && corpo ? corpo : {}) as { texto?: unknown; citados?: unknown };
    if (bruto !== undefined && !Array.isArray(bruto)) throw invalido('citados precisa ser uma lista de ids.', 'citados');
    const fase = UUID.test(id) ? await this.prisma.copaFase.findUnique({ where: { id } }) : null;
    if (!fase) throw naoAchou();
    if (!fase.fechadaEm) throw new ApiError(409, 'FASE_ABERTA', 'Feche a fase antes de publicar o resumo.');
    const jaPublicado = () => new ApiError(409, 'RESUMO_JA_PUBLICADO', 'O resumo desta fase já foi publicado.');
    if (fase.resumoPostId) throw jaPublicado();
    const criado = await this.posts.criar(user, { comoCbf: true, texto }, [], [], false);
    const { count } = await this.prisma.copaFase.updateMany({ where: { id, resumoPostId: null }, data: { resumoPostId: criado.id } });
    if (count === 0) {
      await this.prisma.post.delete({ where: { id: criado.id } });
      throw jaPublicado();
    }
    const pedidos = new Set((bruto ?? []).filter((x): x is string => typeof x === 'string' && UUID.test(x)));
    const clubes = pedidos.size
      ? await this.prisma.club.findMany({
          where: { coachId: { in: [...pedidos] }, OR: [{ copaMandante: { some: { faseId: id } } }, { copaVisitante: { some: { faseId: id } } }] },
          include: { coach: { select: { id: true, name: true } } },
        })
      : [];
    const citados = clubes.filter((c) => c.coach!.id !== user.id && (criado.texto ?? '').includes(c.coach!.name)).map((c) => c.coach!.id);
    const todos = await this.prisma.user.findMany({ where: { id: { notIn: [user.id, ...citados] } }, select: { id: true } });
    void this.push.enviar(todos.map((u) => u.id), { titulo: 'CBF', corpo: `Saiu o resumo da fase ${fase.nome}`, url: `/p/${criado.id}` }, 'cbf');
    void this.atividade.criar(citados, 'CBF_CITOU', { postId: criado.id }).catch((e: unknown) => this.logger.warn(`atividade CBF_CITOU: ${String(e)}`));
    if (citados.length) void this.push.enviar(citados, { titulo: 'A CBF citou você', corpo: (criado.texto ?? '').slice(0, 80), url: `/p/${criado.id}` }, 'cbf');
    return criado;
  }

  private async previaDe(nome: string, js: (PlacarCopa & { mandante: { id: string; name: string; coachId: string | null }; visitante: { id: string; name: string; coachId: string | null } })[], rei: { nome: string; pontos: number } | null) {
    const donos = [...new Set(js.flatMap((j) => [j.mandante, j.visitante]).map((c) => c.coachId).filter((x): x is string => x !== null))];
    const users = await this.prisma.user.findMany({ where: { id: { in: donos } }, select: { id: true, name: true } });
    const nomeDe = new Map(users.map((u) => [u.id, u.name]));
    const tecnicos: Record<string, { id: string; nome: string }> = {};
    for (const c of js.flatMap((j) => [j.mandante, j.visitante])) if (c.coachId) tecnicos[c.id] = { id: c.coachId, nome: nomeDe.get(c.coachId) ?? '' };
    return montarResumoCopa(
      nome,
      js.map((j) => ({ mandante: { id: j.mandante.id, nome: j.mandante.name }, visitante: { id: j.visitante.id, nome: j.visitante.name }, golsMandante: j.golsMandante!, golsVisitante: j.golsVisitante!, penaltisMandante: j.penaltisMandante, penaltisVisitante: j.penaltisVisitante })),
      tecnicos,
      undefined,
      rei,
    );
  }

  /** Trava a fase (FOR UPDATE) e só segue se existir e estiver aberta. */
  private async travar(tx: Tx, id: string) {
    if (!UUID.test(id)) throw naoAchou();
    const [f] = await tx.$queryRaw<{ nome: string; fechadaEm: Date | null }[]>`SELECT "nome", "fechadaEm" FROM "CopaFase" WHERE "id" = ${id}::uuid FOR UPDATE`;
    if (!f) throw naoAchou();
    if (f.fechadaEm) throw new ApiError(409, 'FASE_FECHADA', 'Esta fase está fechada. Reabra para mudar.');
    return f;
  }

  private lerJogos(corpo: unknown): JogoEntrada[] {
    const lista = typeof corpo === 'object' && corpo ? (corpo as { jogos?: unknown }).jogos : undefined;
    if (!Array.isArray(lista) || lista.length > MAX_JOGOS) throw invalido(`Envie \`jogos\`: uma lista de até ${MAX_JOGOS} jogos.`);
    const vistos = new Set<string>();
    return lista.map((j: Record<string, unknown> | null) => {
      const { mandanteId, visitanteId } = j ?? {};
      const [gm, gv, pm, pv] = [j?.golsMandante ?? null, j?.golsVisitante ?? null, j?.penaltisMandante ?? null, j?.penaltisVisitante ?? null];
      if (typeof mandanteId !== 'string' || typeof visitanteId !== 'string' || !mandanteId || !visitanteId) throw invalido('Cada jogo precisa de mandanteId e visitanteId.');
      if (mandanteId === visitanteId) throw invalido('Um clube não joga contra si mesmo.');
      const agendado = gm === null && gv === null;
      if (!agendado && (!gols(gm) || !gols(gv))) throw invalido('O placar vai de 0 a 99, em números inteiros, ou nulo nos dois lados (jogo agendado).');
      const empate = !agendado && gm === gv;
      if (empate ? !gols(pm) || !gols(pv) || pm === pv : pm !== null || pv !== null) throw invalido('Pênaltis: obrigatórios (0 a 99, sem empate) quando o jogo termina empatado, e só nesse caso.', 'penaltis');
      for (const id of [mandanteId, visitanteId]) {
        if (vistos.has(id)) throw invalido('Cada clube joga no máximo uma vez por fase.');
        vistos.add(id);
      }
      return { mandanteId, visitanteId, golsMandante: gm as number | null, golsVisitante: gv as number | null, penaltisMandante: pm as number | null, penaltisVisitante: pv as number | null };
    });
  }
}
