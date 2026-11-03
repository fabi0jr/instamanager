import { EventEmitter } from 'node:events';
import { Injectable } from '@nestjs/common';

/** Eventos internos: `comentarios.criado(commentId)`. A Task 7 (push) escuta aqui. */
@Injectable()
export class InteracoesEventos extends EventEmitter {}
