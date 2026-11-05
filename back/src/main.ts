import { existsSync } from 'node:fs';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { configureApp, servirUploadsEmDev } from './http.js';

// .env único na raiz do repo (o mesmo que o docker-compose usa)
if (existsSync('../.env')) process.loadEnvFile('../.env');

// corpo JSON é registrado pelo configureApp, depois da checagem de Origin
const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false });
configureApp(app);
servirUploadsEmDev(app);
app.setGlobalPrefix('api', { exclude: ['mcp'] }); // /mcp fica fora do /api (e do filtro de Origin)
app.enableShutdownHooks(); // fecha o pool do Postgres no SIGTERM do Docker
await app.listen(process.env.PORT ?? 3000, process.env.HOST ?? '127.0.0.1');
