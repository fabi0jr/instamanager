import { parseCadastro, parsePerfil } from './auth.validation.js';

const ok = { convite: 'x', email: ' Ana@Exemplo.com ', senha: 'senha-boa-123', nome: ' Ana ', clubeId: null };

describe('validação do auth', () => {
  it('normaliza e-mail e nome', () => {
    expect(parseCadastro(ok)).toMatchObject({ email: 'ana@exemplo.com', nome: 'Ana', clubeId: null });
  });

  it('lista os campos inválidos', () => {
    const erro = (() => { try { parseCadastro({ ...ok, email: 'x', senha: '1', clubeId: undefined }); } catch (e) { return e as { getResponse(): { campos: string[] } }; } })()!;
    expect(erro.getResponse().campos).toEqual(['email', 'senha', 'clubeId']);
  });

  it('PATCH /me: trocar senha exige a atual; corpo vazio é válido', () => {
    expect(parsePerfil({})).toEqual({});
    expect(() => parsePerfil({ senhaNova: 'nova-senha-123' })).toThrow();
    expect(parsePerfil({ pushEnabled: false })).toEqual({ pushEnabled: false });
  });
});
