import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { SessionGuard } from '../auth/session.guard.js';
import { ApiError } from '../http.js';
import { PrismaService } from '../prisma.service.js';

const tecnicoDe = (u: { id: string; name: string } | null) => u && { id: u.id, nome: u.name };

@Controller('clubes')
export class ClubesController {
  constructor(private readonly prisma: PrismaService) {}

  // pública: o cadastro lista os clubes livres antes de existir sessão
  @Get()
  async listar(@Query('livres') livres?: string) {
    const clubes = await this.prisma.club.findMany({
      where: livres === '1' ? { coachId: null } : {},
      include: { coach: { select: { id: true, name: true } } },
    });
    return clubes
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
      .map((c) => ({ id: c.id, nome: c.name, escudoUrl: c.crestPath, tecnico: tecnicoDe(c.coach) }));
  }

  @Get(':id')
  @UseGuards(SessionGuard)
  async perfil(@Param('id') id: string) {
    const c = await this.prisma.club.findUnique({
      where: { id },
      include: {
        coach: { select: { id: true, name: true } },
        tenures: { orderBy: { startedAt: 'desc' }, include: { user: { select: { id: true, name: true } } } },
      },
    });
    if (!c) throw new ApiError(404, 'NAO_ENCONTRADO', 'Não encontramos o que você procurou.');
    return {
      id: c.id,
      nome: c.name,
      escudoUrl: c.crestPath,
      tecnico: tecnicoDe(c.coach),
      historico: c.tenures.map((t) => ({ usuario: tecnicoDe(t.user), inicio: t.startedAt, fim: t.endedAt })),
    };
  }
}
