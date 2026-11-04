import { readdirSync, readFileSync } from 'node:fs';
import { expect, test } from 'vitest';

// svg sem width/height colapsa dentro do .ic da barra (a Liga ficou sem ícone em produção): todo ícone traz o tamanho
test.each(readdirSync('src/icones').filter((f) => f.endsWith('.svg')))('icone %s tem width e height 24 e aria-hidden', (arquivo) => {
  const raiz = readFileSync(`src/icones/${arquivo}`, 'utf8').match(/<svg[^>]*>/)![0];
  expect(raiz).toMatch(/\swidth="24"/);
  expect(raiz).toMatch(/\sheight="24"/);
  expect(raiz).toMatch(/aria-hidden="true"/);
});
