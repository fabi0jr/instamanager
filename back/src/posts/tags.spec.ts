import { extrairTags, normalizarTag } from './tags.js';

describe('tags', () => {
  it('normalizarTag: minúsculas, sem acento, só [a-z0-9_]', () => {
    expect(normalizarTag('Contratação')).toBe('contratacao');
    expect(normalizarTag('Ação-2026!')).toBe('acao2026');
    expect(normalizarTag('já_é')).toBe('ja_e');
  });

  it('extrairTags acha #tags normalizadas, sem repetir', () => {
    expect(extrairTags('Reforço #Contratação e #coletiva!')).toEqual(['contratacao', 'coletiva']);
    expect(extrairTags('#um (#dois) "#um"')).toEqual(['um', 'dois']);
  });

  it('# dentro de URL, colado em palavra ou sozinho não vira tag', () => {
    expect(extrairTags('site.com/#x')).toEqual([]);
    expect(extrairTags('a#b')).toEqual([]);
    expect(extrairTags('# sozinho')).toEqual([]);
    expect(extrairTags('')).toEqual([]);
  });
});
