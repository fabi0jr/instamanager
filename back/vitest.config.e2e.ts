import { existsSync } from 'node:fs';
import { defineConfig } from 'vitest/config';

// DATABASE_URL (Postgres do compose) vem do .env da raiz
if (existsSync('../.env')) process.loadEnvFile('../.env');

const base = { globals: true, root: './' };

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    projects: [
      // a maioria roda em paralelo (cada arquivo usa clubes próprios)
      { extends: true, test: { ...base, name: 'paralelo', include: ['**/*.e2e-spec.ts'], exclude: ['**/node_modules/**', '**/convite.e2e-spec.ts'], sequence: { groupOrder: 0 } } },
      // mexe no código de convite, que é global: só roda depois que todo o resto terminou
      { extends: true, test: { ...base, name: 'serial', include: ['**/convite.e2e-spec.ts'], sequence: { groupOrder: 1 } } },
    ],
  },
});
