import { EventEmitter } from 'node:events';
import { Injectable } from '@nestjs/common';

/** Eventos internos: `comentarios.criado(commentId)` e `reacoes.reagida(postId, userId)`. Push e atividade escutam aqui. */
@Injectable()
export class InteracoesEventos extends EventEmitter {}
