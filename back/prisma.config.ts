import { existsSync } from 'node:fs';
import { defineConfig } from 'prisma/config';

// .env único na raiz do repo (o mesmo que o docker-compose usa)
if (existsSync('../.env')) process.loadEnvFile('../.env');

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env['DATABASE_URL'],
  },
});
