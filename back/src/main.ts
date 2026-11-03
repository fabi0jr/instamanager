import { existsSync } from 'node:fs';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

// .env único na raiz do repo (o mesmo que o docker-compose usa)
if (existsSync('../.env')) process.loadEnvFile('../.env');

const app = await NestFactory.create(AppModule);
app.setGlobalPrefix('api');
app.enableShutdownHooks();
await app.listen(process.env.PORT ?? 3000, process.env.HOST ?? '127.0.0.1');
