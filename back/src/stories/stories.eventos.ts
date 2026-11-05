import { EventEmitter } from 'node:events';
import { Injectable } from '@nestjs/common';

/** Eventos internos: `stories.criado(storyId)`. As conquistas escutam aqui. */
@Injectable()
export class StoriesEventos extends EventEmitter {}
