import { Controller, Get, Header, Param } from '@nestjs/common';
import { OgService } from './og.service.js';

/** Pública: quem chama é o nginx, a pedido de robôs de prévia (WhatsApp etc.). Pessoas continuam recebendo o app. */
@Controller('og')
export class OgController {
  constructor(private readonly og: OgService) {}

  @Get('p/:id')
  @Header('Content-Type', 'text/html; charset=utf-8')
  @Header('Cache-Control', 'public, max-age=300')
  @Header('Vary', 'User-Agent')
  pagina(@Param('id') id: string) {
    return this.og.pagina(id);
  }
}
