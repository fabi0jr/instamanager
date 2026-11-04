import { EventEmitter } from 'node:events';
import { Injectable } from '@nestjs/common';

/** Eventos internos: `liga.rodadaFechada(numero)`. O bot da zoeira (IM-40) escuta aqui. */
@Injectable()
export class LigaEventos extends EventEmitter {}
