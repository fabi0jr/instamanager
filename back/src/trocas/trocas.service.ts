import { Injectable } from '@nestjs/common';
import type { UserComClube } from '../auth/auth.service.js';
import type { TrocaStatus, TransferRequest } from '../generated/prisma/client.js';
import { ApiError } from '../http.js';
import { UUID } from '../posts/cursor.js';
import { PrismaService } from '../prisma.service.js';
import { TrocasEventos } from './trocas.eventos.js';

const naoEncontrado = () => new ApiError(404, 'NAO_ENCONTRADO', 'Não encontramos o que você procurou.');
const ocupado = () => new ApiError(409, 'CLUBE_OCUPADO', 'Esse clube já tem técnico.');
const clubeMini = (c: { id: string; name: string; crestPath: string } | null) => c && { id: c.id, nome: c.name, escudoUrl: c.crestPath };

const trocaJson = (t: TransferRequest) => ({ id: t.id, tipo: t.kind, clubeId: t.clubId, status: t.status, criadoEm: t.createdAt, decididoEm: t.decidedAt });

@Injectable()
export class TrocasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventos: TrocasEventos,
  ) {}

  async pedir(user: UserComClube, corpo: unknown) {
    const { tipo, clubeId } = (typeof corpo === 'object' && corpo ? corpo : {}) as { tipo?: unknown; clubeId?: unknown };
    if (tipo !== 'SAIR' && tipo !== 'ASSUMIR') throw new ApiError(400, 'DADOS_INVALIDOS', "tipo precisa ser 'SAIR' ou 'ASSUMIR'.", ['tipo']);
    if (tipo === 'SAIR' && !user.club) throw new ApiError(403, 'SEM_CLUBE', 'Você não tem clube para sair.');
    if (tipo === 'ASSUMIR') {
      if (typeof clubeId !== 'string' || !clubeId) throw new ApiError(400, 'DADOS_INVALIDOS', 'Escolha o clube que quer assumir.', ['clubeId']);
      const clube = await this.prisma.club.findUnique({ where: { id: clubeId } });
      if (!clube) throw naoEncontrado();
      if (clube.coachId) throw ocupado();
    }
    const criada = await this.prisma.$transaction(async (tx) => {
      // trava por pessoa: dois pedidos ao mesmo tempo não passam juntos pela checagem de "um pendente"
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${user.id}))`;
      if (await tx.transferRequest.findFirst({ where: { userId: user.id, status: 'PENDENTE' } }))
        throw new ApiError(409, 'TROCA_PENDENTE', 'Você já tem um pedido pendente.');
      return tx.transferRequest.create({ data: { userId: user.id, kind: tipo, clubId: tipo === 'ASSUMIR' ? (clubeId as string) : null } });
    });
    this.eventos.emit('trocas.pedida', criada.id);
    return trocaJson(criada);
  }

  async minhas(user: UserComClube) {
    const lista = await this.prisma.transferRequest.findMany({ where: { userId: user.id }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] });
    return lista.map(trocaJson);
  }

  async listar(status?: string) {
    if (status !== undefined && !['PENDENTE', 'APROVADA', 'RECUSADA'].includes(status))
      throw new ApiError(400, 'DADOS_INVALIDOS', 'status inválido.', ['status']);
    const lista = await this.prisma.transferRequest.findMany({
      where: status ? { status: status as TrocaStatus } : {},
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      include: { user: { select: { id: true, name: true, club: true } }, club: true },
    });
    return lista.map((t) => ({
      id: t.id,
      tipo: t.kind,
      status: t.status,
      criadoEm: t.createdAt,
      usuario: { id: t.user.id, nome: t.user.name },
      clubeAtual: clubeMini(t.user.club),
      clubeDesejado: clubeMini(t.club),
    }));
  }

  /** Tudo ou nada: se o clube foi ocupado depois do pedido, nada muda e o pedido segue PENDENTE. */
  async aprovar(id: string) {
    if (!UUID.test(id)) throw naoEncontrado();
    await this.prisma.$transaction(async (tx) => {
      const t = await tx.transferRequest.findUnique({ where: { id } });
      if (!t) throw naoEncontrado();
      // marca primeiro: duas aprovações ao mesmo tempo, só uma passa (a outra vê não-PENDENTE)
      const agora = new Date();
      const { count } = await tx.transferRequest.updateMany({ where: { id, status: 'PENDENTE' }, data: { status: 'APROVADA', decidedAt: agora } });
      if (count === 0) throw new ApiError(409, 'TROCA_JA_DECIDIDA', 'Este pedido já foi decidido.');

      const atual = await tx.club.findUnique({ where: { coachId: t.userId } });
      if (atual) {
        await tx.coachTenure.updateMany({ where: { clubId: atual.id, userId: t.userId, endedAt: null }, data: { endedAt: agora } });
        await tx.club.update({ where: { id: atual.id }, data: { coachId: null } });
      }
      if (t.kind === 'ASSUMIR' && t.clubId) {
        // coachId null no WHERE: se alguém ocupou antes, count 0 e a transação inteira volta atrás
        const { count: pegou } = await tx.club.updateMany({ where: { id: t.clubId, coachId: null }, data: { coachId: t.userId } });
        if (pegou === 0) throw ocupado();
        await tx.coachTenure.create({ data: { clubId: t.clubId, userId: t.userId, startedAt: agora } });
      }
    });
    this.eventos.emit('trocas.decidida', id);
  }

  async recusar(id: string) {
    if (!UUID.test(id)) throw naoEncontrado();
    const existe = await this.prisma.transferRequest.findUnique({ where: { id }, select: { id: true } });
    if (!existe) throw naoEncontrado();
    const { count } = await this.prisma.transferRequest.updateMany({ where: { id, status: 'PENDENTE' }, data: { status: 'RECUSADA', decidedAt: new Date() } });
    if (count === 0) throw new ApiError(409, 'TROCA_JA_DECIDIDA', 'Este pedido já foi decidido.');
    this.eventos.emit('trocas.decidida', id);
  }
}
