import { EventEmitter } from 'node:events';
import { Injectable } from '@nestjs/common';

/** Eventos internos: `trocas.pedida(id)` e `trocas.decidida(id)`. A Task 7 (push) escuta aqui. */
@Injectable()
export class TrocasEventos extends EventEmitter {}
