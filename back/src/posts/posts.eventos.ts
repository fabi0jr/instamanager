import { EventEmitter } from 'node:events';
import { Injectable } from '@nestjs/common';

/** Eventos internos (sem dependência): `posts.criado(postId)`. A Task 7 (push) escuta aqui. */
@Injectable()
export class PostsEventos extends EventEmitter {}
