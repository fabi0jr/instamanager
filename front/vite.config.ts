import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { createHash } from 'node:crypto';
import type { Plugin } from 'vite';

// Hash do build = hash dos nomes dos arquivos gerados (já levam o hash do conteúdo): muda só quando o código muda.
// Vai em /version.json e em <meta name="versao"> no index.html; o app compara os dois (AvisoVersao).
const hashDe = (bundle: object) => createHash('sha1').update(Object.keys(bundle).filter((f) => !f.endsWith('.html') && f !== 'version.json').sort().join()).digest('hex').slice(0, 12);
function versaoDoBuild(): Plugin {
  return {
    name: 'versao-do-build',
    apply: 'build',
    generateBundle(_, bundle) {
      this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ versao: hashDe(bundle) }) });
    },
    transformIndexHtml: {
      order: 'post',
      handler: (html, ctx) => html.replace('</head>', `<meta name="versao" content="${hashDe(ctx.bundle ?? {})}" /></head>`),
    },
  };
}

export default defineConfig({
  plugins: [react(), versaoDoBuild()],
  // em dev o back roda à parte; em produção o proxy reverso da VPS faz o mesmo
  server: { proxy: { '/api': 'http://127.0.0.1:3000', '/uploads': 'http://127.0.0.1:3000' } },
  // fora do CI, poucos workers: vários agentes rodando a suíte juntos esgotavam a RAM
  test: { environment: 'jsdom', setupFiles: ['./src/testes/setup.ts'], maxWorkers: process.env.CI ? undefined : 4 },
});
