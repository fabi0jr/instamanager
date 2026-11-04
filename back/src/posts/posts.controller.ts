import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put, Query, Req, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { type AuthedRequest, SessionGuard } from '../auth/session.guard.js';
import { PostsService } from './posts.service.js';

type Arquivos = { cheia?: { buffer: Buffer }[]; mini?: { buffer: Buffer }[] };
const corpo = (b: unknown) => (typeof b === 'object' && b ? (b as Record<string, unknown>) : {});

@Controller('posts')
@UseGuards(SessionGuard)
export class PostsController {
  constructor(private readonly posts: PostsService) {}

  // maxCount 10 e 3 MB por arquivo: o multer recusa antes de qualquer coisa chegar ao disco (400 / 413)
  @Post()
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'cheia', maxCount: 10 },
        { name: 'mini', maxCount: 10 },
      ],
      { limits: { fileSize: 3 * 1024 * 1024 } },
    ),
  )
  criar(@Req() req: AuthedRequest, @Body() body: unknown, @UploadedFiles() arquivos: Arquivos | undefined) {
    return this.posts.criar(req.user, corpo(body), arquivos?.cheia ?? [], arquivos?.mini ?? []);
  }

  @Get()
  feed(@Req() req: AuthedRequest, @Query('antes') antes?: string, @Query('clube') clube?: string, @Query('tag') tag?: string) {
    return this.posts.feed(req.user, antes, clube, tag);
  }

  @Get(':id')
  obter(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.posts.obter(id, req.user);
  }

  @Patch(':id')
  editar(@Req() req: AuthedRequest, @Param('id') id: string, @Body() body: unknown) {
    return this.posts.editar(id, req.user, corpo(body));
  }

  @Put(':id/ocultar-para-mim')
  @HttpCode(204)
  async ocultarParaMim(@Req() req: AuthedRequest, @Param('id') id: string) {
    await this.posts.ocultarParaMim(id, req.user, true);
  }

  @Delete(':id/ocultar-para-mim')
  @HttpCode(204)
  async mostrarParaMim(@Req() req: AuthedRequest, @Param('id') id: string) {
    await this.posts.ocultarParaMim(id, req.user, false);
  }

  @Delete(':id')
  @HttpCode(204)
  async apagar(@Req() req: AuthedRequest, @Param('id') id: string) {
    await this.posts.apagar(id, req.user);
  }
}

@Controller('galeria')
@UseGuards(SessionGuard)
export class GaleriaController {
  constructor(private readonly posts: PostsService) {}

  @Get()
  galeria(@Req() req: AuthedRequest, @Query('antes') antes?: string, @Query('clube') clube?: string, @Query('favoritos') favoritos?: string) {
    return this.posts.galeria(req.user, antes, clube, favoritos === '1');
  }

  @Put(':imagemId/favorito')
  @HttpCode(204)
  async favoritar(@Req() req: AuthedRequest, @Param('imagemId') id: string) {
    await this.posts.favoritar(id, req.user, true);
  }

  @Delete(':imagemId/favorito')
  @HttpCode(204)
  async desfavoritar(@Req() req: AuthedRequest, @Param('imagemId') id: string) {
    await this.posts.favoritar(id, req.user, false);
  }
}
