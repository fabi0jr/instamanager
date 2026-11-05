import { EventEmitter } from 'node:events';
import { Injectable } from '@nestjs/common';

/** Eventos internos: `votacoes.encerrada(votacaoId)`, já com os selos gravados. As conquistas escutam aqui. */
@Injectable()
export class VotacoesEventos extends EventEmitter {}
