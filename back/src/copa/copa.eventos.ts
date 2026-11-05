import { EventEmitter } from 'node:events';
import { Injectable } from '@nestjs/common';

/** Eventos internos: `copa.faseFechada(faseId)`. As conquistas escutam aqui. */
@Injectable()
export class CopaEventos extends EventEmitter {}
