import { EventEmitter } from 'node:events';
import { Injectable } from '@nestjs/common';

/** Eventos internos (sem dependência): `posts.criado(postId)` e `posts.editado(postId)`. Push e atividade escutam aqui. */
@Injectable()
export class PostsEventos extends EventEmitter {}
