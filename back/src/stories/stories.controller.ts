import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Req, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { type AuthedRequest, SessionGuard } from '../auth/session.guard.js';
import { StoriesService } from './stories.service.js';

type Arquivos = { imagem?: { buffer: Buffer }[]; video?: { buffer: Buffer }[] };

@Controller('stories')
@UseGuards(SessionGuard)
export class StoriesController {
  constructor(private readonly stories: StoriesService) {}

  // 60 MB por arquivo no multer (vídeo); imagem acima de 3 MB é recusada no service (413)
  @Post()
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'imagem', maxCount: 1 },
        { name: 'video', maxCount: 1 },
      ],
      { limits: { fileSize: 60 * 1024 * 1024 } },
    ),
  )
  criar(@Req() req: AuthedRequest, @Body() body: unknown, @UploadedFiles() arquivos: Arquivos | undefined) {
    return this.stories.criar(req.user, typeof body === 'object' && body ? body : {}, arquivos?.imagem?.[0], arquivos?.video?.[0]);
  }

  @Get()
  listar(@Req() req: AuthedRequest) {
    return this.stories.listar(req.user);
  }

  @Put(':id/visto')
  @HttpCode(204)
  async visto(@Req() req: AuthedRequest, @Param('id') id: string) {
    await this.stories.visto(id, req.user);
  }

  @Get(':id/vistos')
  vistos(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.stories.vistos(id, req.user);
  }

  @Delete(':id')
  @HttpCode(204)
  async apagar(@Req() req: AuthedRequest, @Param('id') id: string) {
    await this.stories.apagar(id, req.user);
  }
}
