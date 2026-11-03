import { existsSync } from 'node:fs';
import { defineConfig } from 'vitest/config';

// DATABASE_URL (Postgres do compose) vem do .env da raiz
if (existsSync('../.env')) process.loadEnvFile('../.env');

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
  },
});
