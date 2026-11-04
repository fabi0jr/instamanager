import { Body, Controller, Get, Param, Patch, Put, Query, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { type AuthedRequest, SessionGuard } from '../auth/session.guard.js';
import { ApiError } from '../http.js';
import { LigaService } from '../liga/liga.service.js';
import { apagarImagem, ehJpeg, salvarImagem } from '../posts/imagens.js';
import { PrismaService } from '../prisma.service.js';

const BIO_MAX = 300;
const tecnicoDe = (u: { id: string; name: string } | null) => u && { id: u.id, nome: u.name };
const naoEncontrado = () => new ApiError(404, 'NAO_ENCONTRADO', 'Não encontramos o que você procurou.');
const perfilDe = {
  selos: { orderBy: { createdAt: 'desc' } },
  coach: { select: { id: true, name: true } },
  tenures: { orderBy: { startedAt: 'desc' }, include: { user: { select: { id: true, name: true } } } },
} as const;

@Controller('clubes')
export class ClubesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly liga: LigaService,
  ) {}

  // pública: o cadastro lista os clubes livres antes de existir sessão
  @Get()
  async listar(@Query('livres') livres?: string) {
    const clubes = await this.prisma.club.findMany({
      where: livres === '1' ? { coachId: null, oficial: false } : { oficial: false }, // a CBF só aparece em /clubes/cbf e como autora de posts
      include: { coach: { select: { id: true, name: true } } },
    });
    return clubes
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
      .map((c) => ({ id: c.id, nome: c.name, escudoUrl: c.crestPath, tecnico: tecnicoDe(c.coach) }));
  }

  @Get(':id')
  @UseGuards(SessionGuard)
  async perfil(@Param('id') id: string) {
    return this.perfilJson(id);
  }

  /** Bio: só o técnico atual do clube ou o admin. Texto vazio apaga. */
  @Patch(':id')
  @UseGuards(SessionGuard)
  async bio(@Req() req: AuthedRequest, @Param('id') id: string, @Body() body: unknown) {
    await this.exigirDono(id, req);
    const bruto = typeof body === 'object' && body ? (body as { bio?: unknown }).bio : undefined;
    if (typeof bruto !== 'string' || bruto.trim().length > BIO_MAX) throw new ApiError(400, 'DADOS_INVALIDOS', `A bio tem no máximo ${BIO_MAX} caracteres.`, ['bio']);
    await this.prisma.club.update({ where: { id }, data: { bio: bruto.trim() || null } });
    return this.perfilJson(id);
  }

  // limite do multer (3 MB) vira 413 pelo Nest
  @Put(':id/capa')
  @UseGuards(SessionGuard)
  @UseInterceptors(FileInterceptor('capa', { limits: { fileSize: 3 * 1024 * 1024 } }))
  async capa(@Req() req: AuthedRequest, @Param('id') id: string, @UploadedFile() arquivo: { buffer: Buffer } | undefined) {
    const clube = await this.exigirDono(id, req);
    if (!arquivo || !ehJpeg(arquivo.buffer)) throw new ApiError(400, 'IMAGEM_INVALIDA', 'Não consegui ler esta imagem. Envie JPEG.');
    const coverPath = await salvarImagem(arquivo.buffer, 'capas');
    await this.prisma.club.update({ where: { id }, data: { coverPath } });
    if (clube.coverPath) await apagarImagem(clube.coverPath); // a antiga é só lixo no disco
    return this.perfilJson(id);
  }

  private async exigirDono(id: string, req: AuthedRequest) {
    const clube = await this.prisma.club.findUnique({ where: { id } });
    if (!clube) throw naoEncontrado();
    if (!req.user.isAdmin && clube.coachId !== req.user.id) throw new ApiError(403, 'NAO_E_TECNICO', 'Só o técnico atual do clube (ou o admin) faz isso.');
    return clube;
  }

  private async perfilJson(id: string) {
    const c = await this.prisma.club.findUnique({ where: { id }, include: perfilDe });
    if (!c) throw naoEncontrado();
    return {
      id: c.id,
      nome: c.name,
      escudoUrl: c.crestPath,
      bio: c.bio,
      capaUrl: c.coverPath,
      tecnico: tecnicoDe(c.coach),
      liga: await this.liga.doClube(c.id),
      selos: c.selos.map((s) => ({ titulo: s.titulo, createdAt: s.createdAt })),
      historico: c.tenures.map((t) => ({ usuario: tecnicoDe(t.user), inicio: t.startedAt, fim: t.endedAt })),
    };
  }
}
