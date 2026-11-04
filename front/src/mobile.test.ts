import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const ler = (f: string) => readFileSync(f, 'utf8');

describe('IM-24: sem zoom indesejado no iPhone', () => {
  const css = ler('src/tokens.css');
  it('campos têm fonte de 16px (abaixo disso o iOS dá zoom ao focar)', () => {
    expect(css).toMatch(/input,\s*textarea,\s*select\s*\{[^}]*font-size:\s*16px\s*!important/);
  });
  it('toque duplo não dá zoom (touch-action: manipulation)', () => {
    expect(css).toMatch(/touch-action:\s*manipulation/);
  });
  it('zoom de pinça continua liberado', () => {
    const html = ler('index.html');
    expect(html).not.toMatch(/user-scalable\s*=\s*no|maximum-scale/);
    expect(css).not.toMatch(/touch-action:\s*(none|pan-)/);
  });
});

describe('IM-26: safe area do iPhone', () => {
  it('viewport-fit=cover para o app ocupar a tela toda (PWA)', () => {
    expect(ler('index.html')).toMatch(/name="viewport"[^>]*viewport-fit=cover/);
  });
  it('barra inferior e botões fixos respeitam env(safe-area-inset-bottom)', () => {
    const tokens = ler('src/tokens.css');
    expect(tokens).toMatch(/\.barra-inferior\s*\{[^}]*padding:[^;]*env\(safe-area-inset-bottom\)/);
    expect(ler('src/conta/conta.css')).toMatch(/\.acao-fixa\s*\{[^}]*safe-area-inset-bottom/);
    expect(ler('src/galeria/galeria.css')).toMatch(/\.detalhe-acoes\s*\{[^}]*safe-area-inset-bottom/);
    expect(ler('src/feed/feed.css')).toMatch(/\.folha\s*\{[^}]*safe-area-inset-bottom/);
  });
  it('topo respeita a área do entalhe/barra de status', () => {
    expect(ler('src/tokens.css')).toMatch(/body\s*\{[^}]*safe-area-inset-top/);
  });
});

describe('IM-26: iPhone deitado', () => {
  it('laterais respeitam safe-area-inset-left/right', () => {
    expect(ler('src/tokens.css')).toMatch(/body\s*\{[^}]*safe-area-inset-left/);
    expect(ler('src/tokens.css')).toMatch(/\.barra-inferior\s*\{[^}]*safe-area-inset-left/);
    expect(ler('src/galeria/galeria.css')).toMatch(/\.detalhe\s*\{[^}]*safe-area-inset-left/);
  });
});
