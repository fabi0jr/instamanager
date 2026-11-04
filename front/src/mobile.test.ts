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
