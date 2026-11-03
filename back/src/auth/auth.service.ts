import { createHash, randomBytes } from 'node:crypto';
import { unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Prisma, type Club, type User } from '../generated/prisma/client.js';
import { ApiError } from '../http.js';
import { ehJpeg, salvarImagem } from '../posts/imagens.js';
import { PrismaService } from '../prisma.service.js';
import { MailService } from './mail.service.js';
import { hashPassword, verifyPassword } from './password.js';

export const SESSION_COOKIE = 'instamanager_session';
const SESSAO_MS = 30 * 86_400_000;
const RECUPERACAO_MS = 3_600_000;

export const newToken = () => randomBytes(32).toString('base64url');
export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

export function readCookie(header: string | undefined, nome: string): string | undefined {
  for (const par of header?.split(';') ?? []) {
    const i = par.indexOf('=');
    if (i > 0 && par.slice(0, i).trim() === nome) return par.slice(i + 1).trim();
  }
  return undefined;
}

export type UserComClube = User & { club: Club | null };

export const toMe = (u: UserComClube) => ({
  id: u.id,
  nome: u.name,
  email: u.email,
  avatarUrl: u.avatarPath,
  isAdmin: u.isAdmin,
  pushEnabled: u.pushEnabled,
  clube: u.club && { id: u.club.id, nome: u.club.name, escudoUrl: u.club.crestPath },
});

const erroP2002 = (e: unknown) => e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);
  // hash de uma senha qualquer: login com e-mail inexistente gasta o mesmo tempo que um de verdade
  private hashFalso!: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  async onModuleInit() {
    this.hashFalso = await hashPassword(newToken());
  }

  async cadastrar(d: { convite: string; email: string; senha: string; nome: string; clubeId: string | null }) {
    const convite = await this.prisma.setting.findUnique({ where: { key: 'inviteCode' } });
    // sem diferenciar maiúsculas nem espaços nas pontas (digitado no celular); o valor guardado também é comparado em maiúsculas
    if (!convite || convite.value.trim().toUpperCase() !== d.convite.trim().toUpperCase()) throw new ApiError(400, 'CONVITE_INVALIDO', 'Código de convite inválido.');
    const passwordHash = await hashPassword(d.senha);
    const isAdmin = d.email === process.env.ADMIN_EMAIL?.trim().toLowerCase();
    try {
      // usuário, posse do clube e tenure juntos: quem perde a corrida volta tudo atrás
      return await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({ data: { email: d.email, passwordHash, name: d.nome, isAdmin } });
        if (d.clubeId) {
          // coachId null no WHERE: o Postgres serializa as duas escritas e a segunda não acha linha
          const { count } = await tx.club.updateMany({ where: { id: d.clubeId, coachId: null }, data: { coachId: user.id } });
          if (count === 0) {
            if (!(await tx.club.findUnique({ where: { id: d.clubeId } }))) throw new ApiError(404, 'NAO_ENCONTRADO', 'Clube não encontrado.');
            throw new ApiError(409, 'CLUBE_OCUPADO', 'Esse clube acabou de ser escolhido. Escolha outro.');
          }
          await tx.coachTenure.create({ data: { clubId: d.clubeId, userId: user.id } });
        }
        return tx.user.findUniqueOrThrow({ where: { id: user.id }, include: { club: true } });
      });
    } catch (e) {
      if (erroP2002(e)) throw new ApiError(409, 'EMAIL_EM_USO', 'Já existe uma conta com este e-mail.');
      throw e;
    }
  }

  async entrar(email: string, senha: string) {
    const user = await this.prisma.user.findUnique({ where: { email }, include: { club: true } });
    const ok = await verifyPassword(senha, user?.passwordHash ?? this.hashFalso);
    if (!user || !ok) throw new ApiError(401, 'CREDENCIAIS_INVALIDAS', 'E-mail ou senha incorretos.');
    return user;
  }

  async criarSessao(userId: string, res: Response) {
    const token = newToken();
    await this.prisma.session.create({ data: { id: hashToken(token), userId, expiresAt: new Date(Date.now() + SESSAO_MS) } });
    res.cookie(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/api',
      maxAge: SESSAO_MS,
    });
  }

  /** Sessão válida do pedido, ou null. shortcut: expira em 30 dias sem renovar; renovar se reclamarem de login frequente. */
  async buscarSessao(req: Request) {
    const token = readCookie(req.headers.cookie, SESSION_COOKIE);
    if (!token) return null;
    const sessao = await this.prisma.session.findUnique({ where: { id: hashToken(token) }, include: { user: { include: { club: true } } } });
    return sessao && sessao.expiresAt > new Date() ? sessao : null;
  }

  async sair(req: Request, res: Response) {
    const token = readCookie(req.headers.cookie, SESSION_COOKIE);
    if (token) await this.prisma.session.deleteMany({ where: { id: hashToken(token) } });
    res.clearCookie(SESSION_COOKIE, { path: '/api' });
  }

  /** Responde igual com ou sem conta: banco e envio em segundo plano. */
  esqueci(email: string) {
    void this.criarLink(email).catch((e: unknown) => this.logger.error(`falha no pedido de senha nova: ${String(e)}`));
  }

  private async criarLink(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) return;
    const token = newToken();
    await this.prisma.$transaction([
      this.prisma.passwordReset.deleteMany({ where: { userId: user.id, usedAt: null } }),
      this.prisma.passwordReset.create({ data: { tokenHash: hashToken(token), userId: user.id, expiresAt: new Date(Date.now() + RECUPERACAO_MS) } }),
    ]);
    await this.mail.enviarRecuperacao(user.email, user.name, token);
  }

  /** Troca a senha pelo link (uso único, 1 h) e derruba todas as sessões. */
  async redefinir(token: string, senha: string) {
    const invalido = () => new ApiError(400, 'TOKEN_INVALIDO', 'Este link não vale mais. Peça um novo.');
    const agora = new Date();
    const tokenHash = hashToken(token);
    const reg = await this.prisma.passwordReset.findUnique({ where: { tokenHash } });
    if (!reg || reg.usedAt || reg.expiresAt <= agora) throw invalido();
    const passwordHash = await hashPassword(senha);
    await this.prisma.$transaction(async (tx) => {
      // usedAt null no WHERE: dois cliques ao mesmo tempo, só um usa o token
      const { count } = await tx.passwordReset.updateMany({ where: { tokenHash, usedAt: null }, data: { usedAt: agora } });
      if (count === 0) throw invalido();
      await tx.user.update({ where: { id: reg.userId }, data: { passwordHash } });
      await tx.session.deleteMany({ where: { userId: reg.userId } });
      // todas as sessões caíram: os aparelhos também deixam de receber push até entrarem de novo
      await tx.pushSubscription.deleteMany({ where: { userId: reg.userId } });
    });
  }

  async atualizarPerfil(user: UserComClube, sessaoId: string, d: { nome?: string; pushEnabled?: boolean; senhaAtual?: string; senhaNova?: string }) {
    let passwordHash: string | undefined;
    if (d.senhaNova) {
      if (!(await verifyPassword(d.senhaAtual!, user.passwordHash)))
        throw new ApiError(400, 'SENHA_ATUAL_INVALIDA', 'A senha atual está incorreta.');
      passwordHash = await hashPassword(d.senhaNova);
    }
    const [atualizado] = await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: user.id }, data: { name: d.nome, pushEnabled: d.pushEnabled, passwordHash }, include: { club: true } }),
      // trocar a senha derruba as outras sessões; a atual continua
      ...(passwordHash ? [this.prisma.session.deleteMany({ where: { userId: user.id, id: { not: sessaoId } } })] : []),
    ]);
    return atualizado;
  }

  async trocarFoto(user: UserComClube, buf: Buffer | undefined) {
    if (!buf || !ehJpeg(buf)) throw new ApiError(400, 'IMAGEM_INVALIDA', 'Não consegui ler esta imagem. Envie um JPEG.');
    const avatarPath = await salvarImagem(buf, 'avatares');
    const atualizado = await this.prisma.user.update({ where: { id: user.id }, data: { avatarPath }, include: { club: true } });
    if (user.avatarPath) {
      // foto antiga é só lixo: falha ao apagar não desfaz a troca
      await unlink(join(process.env.UPLOADS_DIR ?? './uploads', user.avatarPath.replace('/uploads/', ''))).catch(() => undefined);
    }
    return atualizado;
  }
}
