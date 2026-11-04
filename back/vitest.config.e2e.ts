import { existsSync } from 'node:fs';
import { defineConfig } from 'vitest/config';

// DATABASE_URL (Postgres do compose) vem do .env da raiz
if (existsSync('../.env')) process.loadEnvFile('../.env');

// Os arquivos rodam um de cada vez: eles dividem o mesmo banco e têm estado global (máx. 3 fixados, tabela da liga, avisos de votação para todos),
// o que em paralelo dava falha aleatória. Os testes de dentro de cada arquivo seguem como estão.
const base = { globals: true, root: './', fileParallelism: false };

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    projects: [
      // cada arquivo usa clubes próprios
      { extends: true, test: { ...base, name: 'geral', include: ['**/*.e2e-spec.ts'], exclude: ['**/node_modules/**', '**/convite.e2e-spec.ts'], sequence: { groupOrder: 0 } } },
      // mexe no código de convite, que é global: só roda depois que todo o resto terminou
      { extends: true, test: { ...base, name: 'serial', include: ['**/convite.e2e-spec.ts'], sequence: { groupOrder: 1 } } },
    ],
  },
});
