import { ApiError } from '../http.js';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
type Corpo = Record<string, unknown>;

function validar<T>(body: unknown, regras: (b: Corpo, erro: (campo: string) => void) => T): T {
  const campos: string[] = [];
  const r = regras(typeof body === 'object' && body ? (body as Corpo) : {}, (c) => campos.push(c));
  if (campos.length) throw new ApiError(400, 'DADOS_INVALIDOS', 'Confira os dados enviados.', campos);
  return r;
}

const email = (v: unknown, erro: (c: string) => void) => {
  const e = typeof v === 'string' ? v.trim().toLowerCase() : '';
  if (!EMAIL.test(e) || e.length > 254) erro('email');
  return e;
};
const senha = (v: unknown, campo: string, erro: (c: string) => void) => {
  if (typeof v !== 'string' || v.length < 8 || v.length > 128) erro(campo);
  return v as string;
};
const nome = (v: unknown, erro: (c: string) => void) => {
  const n = typeof v === 'string' ? v.trim() : '';
  if (n.length < 1 || n.length > 60) erro('nome');
  return n;
};
const texto = (v: unknown, campo: string, erro: (c: string) => void, max = 200) => {
  if (typeof v !== 'string' || !v || v.length > max) erro(campo);
  return v as string;
};

export const parseCadastro = (body: unknown) =>
  validar(body, (b, erro) => ({
    convite: texto(b.convite, 'convite', erro),
    email: email(b.email, erro),
    senha: senha(b.senha, 'senha', erro),
    nome: nome(b.nome, erro),
    clubeId: b.clubeId === null ? null : texto(b.clubeId, 'clubeId', erro),
  }));

export const parseEntrar = (body: unknown) =>
  validar(body, (b, erro) => ({
    email: email(b.email, erro),
    // nenhuma senha válida passa de 128: recusa antes de gastar um scrypt
    senha: texto(b.senha, 'senha', erro, 128),
  }));

export const parseEmail = (body: unknown) => validar(body, (b, erro) => email(b.email, erro));

export const parseRedefinir = (body: unknown) =>
  validar(body, (b, erro) => ({ token: texto(b.token, 'token', erro), senha: senha(b.senha, 'senha', erro) }));

export const parsePerfil = (body: unknown) =>
  validar(body, (b, erro) => {
    const r: { nome?: string; pushEnabled?: boolean; senhaAtual?: string; senhaNova?: string } = {};
    if (b.nome !== undefined) r.nome = nome(b.nome, erro);
    if (b.pushEnabled !== undefined) {
      if (typeof b.pushEnabled !== 'boolean') erro('pushEnabled');
      else r.pushEnabled = b.pushEnabled;
    }
    if (b.senhaNova !== undefined || b.senhaAtual !== undefined) {
      r.senhaAtual = texto(b.senhaAtual, 'senhaAtual', erro, 128);
      r.senhaNova = senha(b.senhaNova, 'senhaNova', erro);
    }
    return r;
  });
