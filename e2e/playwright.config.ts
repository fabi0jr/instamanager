import { defineConfig, devices } from '@playwright/test';

// Caminhos críticos no Safari (WebKit, iPhone 13). Só o CI instala o WebKit; localmente: pnpm --filter e2e test:safari
export default defineConfig({
  testDir: './tests',
  globalSetup: './global-setup.ts',
  workers: 1, // os testes compartilham o banco e o mesmo técnico
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:5173',
    storageState: '.auth/tecnico.json',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'webkit', use: { ...devices['iPhone 13'] } }],
  webServer: [
    { command: 'pnpm --filter back start', url: 'http://127.0.0.1:3000/api/clubes?livres=1', reuseExistingServer: !process.env.CI, timeout: 180_000 },
    { command: 'pnpm --filter front dev', url: 'http://localhost:5173', reuseExistingServer: !process.env.CI, timeout: 120_000 },
  ],
});
