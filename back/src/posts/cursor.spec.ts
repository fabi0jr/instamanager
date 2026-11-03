import { codificarCursor, decodificarCursor } from './cursor.js';

const id = '00000000-0000-4000-8000-000000000001';

describe('cursor', () => {
  it('vai e volta', () => {
    const d = new Date('2026-06-01T12:00:00.123Z');
    expect(decodificarCursor(codificarCursor(d, id))).toEqual({ criadoEm: d, id });
  });
  it('vazio = primeira página; lixo → 400', () => {
    expect(decodificarCursor(undefined)).toBeNull();
    expect(() => decodificarCursor('lixo')).toThrow();
    expect(() => decodificarCursor(Buffer.from(`2026-06-01T00:00:00Z|nao-uuid`).toString('base64url'))).toThrow();
  });
});
