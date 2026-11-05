import { Injectable } from '@nestjs/common';
import { ladoVencedor } from '../copa/copa.js';
import { ApiError } from '../http.js';
import { gols } from '../liga/liga.service.js';
import { UUID } from '../posts/cursor.js';
import { PrismaService } from '../prisma.service.js';
import { pontosPalpite } from './pontos.js';

const MAX_LOTE = 50;
const invalido = (msg: string, campo = 'palpites') => new ApiError(400, 'DADOS_INVALIDOS', msg, [campo]);
const naoAchou = () => new ApiError(404, 'NAO_ENCONTRADO', 'Jogo não encontrado.');
const prazoEncerrado = () => new ApiError(409, 'PRAZO_ENCERRADO', 'O palpite deste jogo está encerrado (prazo acabou, sem prazo, ou o jogo já tem resultado).');
const aberto = (prazo: Date | null, agora: Date) => prazo !== null && agora < prazo;

type Entrada = { jogoId: string | null; copaJogoId: string | null; golsMandante: number; golsVisitante: number; classificadoId: string | null };
type Rei = { nome: string; pontos: number };

type PalpiteComJogo = {
  golsMandante: number;
  golsVisitante: number;
  classificadoId: string | null;
  jogo: { golsMandante: number | null; golsVisitante: number | null } | null;
  copaJogo: { golsMandante: number | null; golsVisitante: number | null; penaltisMandante: number | null; penaltisVisitante: number | null; mandanteId: string; visitanteId: string } | null;
};

/** Pontos de um palpite, calculados na hora: `pontos` é null quando o jogo ainda não tem placar. */
function avaliar(p: PalpiteComJogo) {
  const alvo = p.jogo ?? p.copaJogo;
  if (!alvo || alvo.golsMandante === null) return { pontos: null, exato: false };
  const copa = p.copaJogo;
  const l = copa && ladoVencedor(copa);
  return pontosPalpite(p, alvo, copa ? { vencedorId: l ? (l === 'M' ? copa.mandanteId : copa.visitanteId) : null } : undefined);
}

const incluirJogos = { jogo: true, copaJogo: true } as const;

@Injectable()
export class BolaoService {
  constructor(private readonly prisma: PrismaService) {}

  /** Lote: valida tudo e confere todos os prazos antes de gravar; um alvo fora do prazo derruba o lote inteiro (409). */
  async palpitar(userId: string, corpo: unknown, agora = new Date()) {
    const itens = this.ler(corpo);
    const jogoIds = itens.flatMap((i) => (i.jogoId ? [i.jogoId] : []));
    const copaIds = itens.flatMap((i) => (i.copaJogoId ? [i.copaJogoId] : []));
    const [jogos, copas] = await Promise.all([
      this.prisma.jogo.findMany({ where: { id: { in: jogoIds } }, include: { rodada: { select: { prazoPalpite: true, fechadaEm: true } } } }),
      this.prisma.copaJogo.findMany({ where: { id: { in: copaIds } }, include: { fase: { select: { prazoPalpite: true, fechadaEm: true } } } }),
    ]);
    if (jogos.length !== jogoIds.length || copas.length !== copaIds.length) throw naoAchou();
    const copa = new Map(copas.map((c) => [c.id, c]));
    // prazo reaberto depois do jogo não vale: com placar lançado ou rodada/fase fechada, o palpite está encerrado
    const travado = [...jogos.map((j) => ({ prazo: j.rodada.prazoPalpite, fechada: j.rodada.fechadaEm !== null, placar: j.golsMandante !== null })), ...copas.map((c) => ({ prazo: c.fase.prazoPalpite, fechada: c.fase.fechadaEm !== null, placar: c.golsMandante !== null }))];
    if (travado.some((t) => !aberto(t.prazo, agora) || t.fechada || t.placar)) throw prazoEncerrado();

    const gravar = itens.map((i) => {
      let classificadoId: string | null = null;
      if (i.copaJogoId) {
        const c = copa.get(i.copaJogoId)!;
        const implicito = i.golsMandante === i.golsVisitante ? null : i.golsMandante > i.golsVisitante ? c.mandanteId : c.visitanteId;
        if (implicito === null && (i.classificadoId === null || ![c.mandanteId, c.visitanteId].includes(i.classificadoId))) throw invalido('Palpite de empate na Copa precisa de classificadoId (um dos dois clubes do jogo).', 'classificadoId');
        if (implicito !== null && i.classificadoId !== null && i.classificadoId !== implicito) throw invalido('classificadoId não bate com o placar palpitado.', 'classificadoId');
        classificadoId = implicito ?? i.classificadoId;
      } else if (i.classificadoId !== null) throw invalido('classificadoId só vale para jogo da Copa.', 'classificadoId');
      const dados = { golsMandante: i.golsMandante, golsVisitante: i.golsVisitante, classificadoId };
      return i.jogoId
        ? this.prisma.palpite.upsert({ where: { userId_jogoId: { userId, jogoId: i.jogoId } }, create: { userId, jogoId: i.jogoId, ...dados }, update: dados })
        : this.prisma.palpite.upsert({ where: { userId_copaJogoId: { userId, copaJogoId: i.copaJogoId! } }, create: { userId, copaJogoId: i.copaJogoId!, ...dados }, update: dados });
    });
    await this.prisma.$transaction(gravar);
  }

  /** Meus palpites de uma rodada (`?rodada=N`) ou fase (`?fase=id`). */
  async meus(userId: string, q: { rodada?: string; fase?: string }) {
    const n = q.rodada === undefined ? NaN : Number(q.rodada);
    if ((q.rodada === undefined) === (q.fase === undefined)) throw invalido('Informe rodada=N ou fase=id.', 'rodada');
    if (q.rodada !== undefined && !Number.isInteger(n)) throw invalido('rodada precisa ser um número.', 'rodada');
    if (q.fase !== undefined && !UUID.test(q.fase)) throw invalido('fase precisa ser um id.', 'fase');
    const ps = await this.prisma.palpite.findMany({
      where: { userId, ...(q.rodada !== undefined ? { jogo: { rodadaNumero: n } } : { copaJogo: { faseId: q.fase } }) },
      include: incluirJogos,
      orderBy: { id: 'asc' },
    });
    return ps.map((p) => ({ jogoId: p.jogoId, copaJogoId: p.copaJogoId, golsMandante: p.golsMandante, golsVisitante: p.golsVisitante, classificadoId: p.classificadoId, ...avaliar(p) }));
  }

  /** Palpites de todos num jogo, só depois do prazo. Antes (ou sem prazo), só o meu. */
  async doJogo(userId: string, tipo: string, id: string, agora = new Date()) {
    const t = tipo.toUpperCase();
    if ((t !== 'BRASILEIRAO' && t !== 'COPA') || !UUID.test(id)) throw naoAchou();
    const prazo = t === 'COPA'
      ? (await this.prisma.copaJogo.findUnique({ where: { id }, select: { fase: { select: { prazoPalpite: true } } } }))?.fase.prazoPalpite
      : (await this.prisma.jogo.findUnique({ where: { id }, select: { rodada: { select: { prazoPalpite: true } } } }))?.rodada.prazoPalpite;
    if (prazo === undefined) throw naoAchou();
    const liberado = prazo !== null && agora >= prazo;
    const ps = await this.prisma.palpite.findMany({
      where: { ...(t === 'COPA' ? { copaJogoId: id } : { jogoId: id }), ...(liberado ? {} : { userId }) },
      include: { ...incluirJogos, user: { select: { id: true, name: true, avatarPath: true } } },
    });
    return ps
      .map((p) => ({ usuario: { id: p.user.id, nome: p.user.name, avatarUrl: p.user.avatarPath }, golsMandante: p.golsMandante, golsVisitante: p.golsVisitante, classificadoId: p.classificadoId, ...avaliar(p) }))
      .sort((a, b) => (b.pontos ?? -1) - (a.pontos ?? -1) || a.usuario.nome.localeCompare(b.usuario.nome, 'pt-BR'));
  }

  /** Soma de tudo; desempate por placares exatos e depois por nome. Só entra quem já palpitou. */
  async ranking(escopo: { jogo?: object; copaJogo?: object } = {}) {
    const ps = await this.prisma.palpite.findMany({
      where: escopo.jogo ? { jogo: escopo.jogo } : escopo.copaJogo ? { copaJogo: escopo.copaJogo } : {},
      include: { ...incluirJogos, user: { select: { id: true, name: true, avatarPath: true } } },
    });
    const por = new Map<string, { usuario: { id: string; nome: string; avatarUrl: string | null }; pontos: number; exatos: number }>();
    for (const p of ps) {
      const l = por.get(p.userId) ?? { usuario: { id: p.user.id, nome: p.user.name, avatarUrl: p.user.avatarPath }, pontos: 0, exatos: 0 };
      const a = avaliar(p);
      l.pontos += a.pontos ?? 0;
      l.exatos += a.exato ? 1 : 0;
      por.set(p.userId, l);
    }
    return [...por.values()]
      .sort((a, b) => b.pontos - a.pontos || b.exatos - a.exatos || a.usuario.nome.localeCompare(b.usuario.nome, 'pt-BR'))
      .map((l, i) => ({ ...l, posicao: i + 1 }));
  }

  /** Quem liderou o bolão numa rodada (para o resumo da CBF); null se ninguém pontuou. */
  async reiDaRodada(n: number): Promise<Rei | null> {
    return this.rei(await this.ranking({ jogo: { rodadaNumero: n } }));
  }

  async reiDaFase(faseId: string): Promise<Rei | null> {
    return this.rei(await this.ranking({ copaJogo: { faseId } }));
  }

  private rei(r: { usuario: { nome: string }; pontos: number }[]): Rei | null {
    return r[0] && r[0].pontos > 0 ? { nome: r[0].usuario.nome, pontos: r[0].pontos } : null;
  }

  private ler(corpo: unknown): Entrada[] {
    if (!Array.isArray(corpo) || !corpo.length || corpo.length > MAX_LOTE) throw invalido(`Envie uma lista de 1 a ${MAX_LOTE} palpites.`);
    const vistos = new Set<string>();
    return corpo.map((x: Record<string, unknown> | null) => {
      const { jogoId = null, copaJogoId = null, golsMandante, golsVisitante, classificadoId = null } = x ?? {};
      const alvo = (jogoId === null) === (copaJogoId === null) ? null : (jogoId ?? copaJogoId);
      if (typeof alvo !== 'string' || !UUID.test(alvo)) throw invalido('Cada palpite precisa de jogoId ou copaJogoId (um só), com um id válido.');
      if (!gols(golsMandante) || !gols(golsVisitante)) throw invalido('O placar vai de 0 a 99, em números inteiros.');
      if (classificadoId !== null && typeof classificadoId !== 'string') throw invalido('classificadoId precisa ser um id de clube.', 'classificadoId');
      if (vistos.has(alvo)) throw invalido('Palpite repetido para o mesmo jogo.');
      vistos.add(alvo);
      return { jogoId: jogoId as string | null, copaJogoId: copaJogoId as string | null, golsMandante, golsVisitante, classificadoId };
    });
  }
}
