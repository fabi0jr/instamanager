import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { AdminGuard, SessionGuard } from '../auth/session.guard.js';
import { ApiError } from '../http.js';
import { DenunciasService } from '../denuncias/denuncias.service.js';
import { InteracoesService } from '../interacoes/interacoes.service.js';
import { resumir } from '../mcp/ferramentas.js';
import { PostsService } from '../posts/posts.service.js';
import { PrismaService } from '../prisma.service.js';
import { TrocasService } from '../trocas/trocas.service.js';

@Controller('admin')
@UseGuards(SessionGuard, AdminGuard)
export class AdminController {
  constructor(
    private readonly trocas: TrocasService,
    private readonly prisma: PrismaService,
    private readonly posts: PostsService,
    private readonly interacoes: InteracoesService,
    private readonly denuncias: DenunciasService,
  ) {}

  @Get('trocas')
  listar(@Query('status') status?: string) {
    return this.trocas.listar(status);
  }

  @Post('trocas/:id/aprovar')
  @HttpCode(204)
  async aprovar(@Param('id') id: string) {
    await this.trocas.aprovar(id);
  }

  @Post('trocas/:id/recusar')
  @HttpCode(204)
  async recusar(@Param('id') id: string) {
    await this.trocas.recusar(id);
  }

  @Put('posts/:id/fixar')
  @HttpCode(204)
  async fixar(@Param('id') id: string) {
    await this.posts.fixar(id, true);
  }

  @Delete('posts/:id/fixar')
  @HttpCode(204)
  async desafixar(@Param('id') id: string) {
    await this.posts.fixar(id, false);
  }

  @Put('posts/:id/ocultar')
  @HttpCode(204)
  async ocultar(@Param('id') id: string) {
    await this.posts.ocultar(id, true);
  }

  @Delete('posts/:id/ocultar')
  @HttpCode(204)
  async mostrar(@Param('id') id: string) {
    await this.posts.ocultar(id, false);
  }

  @Put('comentarios/:id/ocultar')
  @HttpCode(204)
  async ocultarComentario(@Param('id') id: string) {
    await this.interacoes.ocultar(id, true);
  }

  @Delete('comentarios/:id/ocultar')
  @HttpCode(204)
  async mostrarComentario(@Param('id') id: string) {
    await this.interacoes.ocultar(id, false);
  }

  @Get('denuncias')
  listarDenuncias(@Query('abertas') abertas?: string, @Query('antes') antes?: string) {
    return this.denuncias.listar(abertas === '1', antes);
  }

  @Post('denuncias/:id/resolver')
  @HttpCode(204)
  async resolverDenuncia(@Param('id') id: string) {
    await this.denuncias.resolver(id);
  }

  /** Log das ações de escrita da CBF via MCP: as 100 mais novas. */
  @Get('mcp')
  async mcp() {
    const lista = await this.prisma.mcpAcao.findMany({ orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 100 });
    return lista.map((a) => ({ id: a.id, ferramenta: a.ferramenta, resumo: resumir(a.ferramenta, a.entrada), ok: a.ok, erro: a.erro, criadaEm: a.createdAt }));
  }

  @Get('convite')
  async convite() {
    return { codigo: (await this.prisma.setting.findUnique({ where: { key: 'inviteCode' } }))?.value ?? null };
  }

  @Put('convite')
  async trocarConvite(@Body() body: unknown) {
    const bruto = typeof body === 'object' && body ? (body as { codigo?: unknown }).codigo : undefined;
    const codigo = typeof bruto === 'string' ? bruto.trim().toUpperCase() : '';
    if (codigo.length < 4 || codigo.length > 64) throw new ApiError(400, 'DADOS_INVALIDOS', 'O código precisa ter de 4 a 64 caracteres.', ['codigo']);
    await this.prisma.setting.upsert({ where: { key: 'inviteCode' }, update: { value: codigo }, create: { key: 'inviteCode', value: codigo } });
    return { codigo };
  }

  @Post('clubes/:id/remover-tecnico')
  @HttpCode(204)
  async removerTecnico(@Param('id') id: string) {
    const clube = await this.prisma.club.findUnique({ where: { id } });
    if (!clube) throw new ApiError(404, 'NAO_ENCONTRADO', 'Não encontramos o que você procurou.');
    const coachId = clube.coachId;
    if (!coachId) return; // já está vago
    await this.prisma.$transaction([
      this.prisma.coachTenure.updateMany({ where: { clubId: id, userId: coachId, endedAt: null }, data: { endedAt: new Date() } }),
      this.prisma.club.updateMany({ where: { id, coachId }, data: { coachId: null } }),
    ]);
  }
}
