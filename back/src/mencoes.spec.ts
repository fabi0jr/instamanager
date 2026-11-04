import { comNomes, extrairMencoes } from './mencoes.js';

const A = '0b00c6de-c639-4645-9c0d-e3d5f8d5c8ff';
const B = '11111111-2222-4333-8444-555555555555';

describe('extrairMencoes', () => {
  it('extrai uuids únicos do formato @[Nome](uuid)', () => {
    expect(extrairMencoes(`oi @[Dudu](${A}) e @[Outro](${B}) de novo @[Dudu](${A.toUpperCase()})`)).toEqual([A, B]);
  });

  it('ignora @nome solto, uuid malformado e colchetes quebrados', () => {
    expect(extrairMencoes(`@Dudu @[Dudu](123) @[Dudu]${A} @[Dudu\n](${A}) [Dudu](${A})`)).toEqual([]);
  });

  it('corta em 10', () => {
    const ids = Array.from({ length: 12 }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`);
    const r = extrairMencoes(ids.map((id) => `@[x](${id})`).join(' '));
    expect(r).toEqual(ids.slice(0, 10));
  });
});

describe('comNomes', () => {
  it('usa o nome do banco, não o do texto; id que não resolveu some', () => {
    expect(comNomes(`oi @[Falso](${A}) e @[Fantasma](${B}).`, [{ id: A, nome: 'Dudu' }])).toBe('oi @Dudu e .');
  });
});
