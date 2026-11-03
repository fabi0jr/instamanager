import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // em dev o back roda à parte; em produção o proxy reverso da VPS faz o mesmo
  server: { proxy: { '/api': 'http://127.0.0.1:3000', '/uploads': 'http://127.0.0.1:3000' } },
  // fora do CI, poucos workers: vários agentes rodando a suíte juntos esgotavam a RAM
  test: { environment: 'jsdom', maxWorkers: process.env.CI ? undefined : 4 },
});
