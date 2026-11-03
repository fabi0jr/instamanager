import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { fetchFalso } from '../testes/fetchFalso';
import { Cadastro } from './Cadastro';
import { Entrar } from './Entrar';
import { Esqueci } from './Esqueci';
import { NovaSenha } from './NovaSenha';
import { Perfil } from './Perfil';

vi.mock('../postar/comprimir', () => ({ comprimir: vi.fn(async () => ({ blob: new Blob(['j']), largura: 480, altura: 480 })), ErroImagem: class extends Error {} }));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const escreve = (rotulo: string, valor: string) => fireEvent.change(screen.getByLabelText(rotulo), { target: { value: valor } });
const clica = (nome: string) => fireEvent.click(screen.getByRole('button', { name: nome }));
const me = { id: '1', nome: 'Lincoln', email: 'l@x.com', avatarUrl: null, isAdmin: false, pushEnabled: false, clube: null };
const livres = [
  { id: 'palmeiras', nome: 'Palmeiras', escudoUrl: '/escudos/palmeiras.svg', tecnico: null },
  { id: 'flamengo', nome: 'Flamengo', escudoUrl: '/escudos/flamengo.svg', tecnico: null },
];

async function ateOClube() {
  render(<Cadastro aoEntrar={() => {}} />);
  escreve('Código de convite', 'ABC');
  clica('Continuar');
  escreve('Nome de exibição', 'Lincoln');
  escreve('E-mail', 'l@x.com');
  escreve('Senha', 'senha1234');
  clica('Continuar');
  await screen.findByRole('radiogroup');
}

test('cadastro mostra só clubes livres + opção torcedor', async () => {
  const chamadas = fetchFalso({ 'GET /clubes?livres=1': livres });
  await ateOClube();
  expect(chamadas[0].chave).toBe('GET /clubes?livres=1');
  expect(screen.getAllByRole('radio').map((r) => r.textContent)).toEqual(['Palmeiras', 'Flamengo', 'Sou só torcedor']);
  expect((screen.getByRole('button', { name: 'Criar conta' }) as HTMLButtonElement).disabled).toBe(true);
});

test('cadastro envia tudo no passo 3 (clubeId null para torcedor)', async () => {
  const aoEntrar = vi.fn();
  const chamadas = fetchFalso({ 'GET /clubes?livres=1': livres, 'POST /auth/cadastro': { status: 201, corpo: me } });
  render(<Cadastro aoEntrar={aoEntrar} />);
  escreve('Código de convite', 'ABC');
  clica('Continuar');
  escreve('Nome de exibição', 'Lincoln');
  escreve('E-mail', 'l@x.com');
  escreve('Senha', 'senha1234');
  clica('Continuar');
  fireEvent.click(await screen.findByRole('radio', { name: 'Sou só torcedor' }));
  clica('Criar conta');
  await waitFor(() => expect(aoEntrar).toHaveBeenCalled());
  const post = chamadas.find((c) => c.chave === 'POST /auth/cadastro')!;
  expect(JSON.parse(post.body as string)).toEqual({ convite: 'ABC', email: 'l@x.com', senha: 'senha1234', nome: 'Lincoln', clubeId: null });
});

test('409 CLUBE_OCUPADO → aviso com o clube e a lista recarrega sem ele', async () => {
  let n = 0;
  fetchFalso({
    'GET /clubes?livres=1': () => (n++ === 0 ? livres : [livres[1]]),
    'POST /auth/cadastro': { status: 409, corpo: { codigo: 'CLUBE_OCUPADO', mensagem: 'x' } },
  });
  await ateOClube();
  fireEvent.click(screen.getByRole('radio', { name: 'Palmeiras' }));
  clica('Criar conta');
  expect((await screen.findByRole('alert')).textContent).toContain('O Palmeiras acabou de ganhar um técnico. Escolha outro clube.');
  await waitFor(() => expect(screen.queryByRole('radio', { name: 'Palmeiras' })).toBeNull());
  expect(screen.getAllByRole('radio').every((r) => r.getAttribute('aria-checked') === 'false')).toBe(true);
});

test('convite inválido → volta ao passo 1 com a mensagem no campo', async () => {
  fetchFalso({ 'GET /clubes?livres=1': livres, 'POST /auth/cadastro': { status: 400, corpo: { codigo: 'CONVITE_INVALIDO', mensagem: 'x' } } });
  await ateOClube();
  fireEvent.click(screen.getByRole('radio', { name: 'Sou só torcedor' }));
  clica('Criar conta');
  expect(await screen.findByText('Esse código não vale. Confira com quem te convidou.')).toBeTruthy();
  expect(screen.getByLabelText('Código de convite')).toBeTruthy();
});

test('e-mail em uso → volta ao passo 2 com a mensagem no campo de e-mail', async () => {
  fetchFalso({ 'GET /clubes?livres=1': livres, 'POST /auth/cadastro': { status: 409, corpo: { codigo: 'EMAIL_EM_USO', mensagem: 'x' } } });
  await ateOClube();
  fireEvent.click(screen.getByRole('radio', { name: 'Sou só torcedor' }));
  clica('Criar conta');
  expect(await screen.findByText('Esse e-mail já tem conta. Entre ou recupere a senha.')).toBeTruthy();
  expect((screen.getByLabelText('E-mail') as HTMLInputElement).value).toBe('l@x.com');
});

test('entrar com credenciais erradas mostra aviso genérico e sucesso chama aoEntrar', async () => {
  const aoEntrar = vi.fn();
  let ok = false;
  fetchFalso({ 'POST /auth/entrar': () => (ok ? me : { status: 401, corpo: { codigo: 'CREDENCIAIS_INVALIDAS', mensagem: 'x' } }) });
  render(<Entrar aoEntrar={aoEntrar} />);
  escreve('E-mail', 'l@x.com');
  escreve('Senha', 'errada123');
  clica('Entrar');
  expect((await screen.findByRole('alert')).textContent).toContain('E-mail ou senha incorretos. Tente de novo.');
  ok = true;
  clica('Entrar');
  await waitFor(() => expect(aoEntrar).toHaveBeenCalled());
});

test('esqueci mostra sempre "Confira seu e-mail"', async () => {
  fetchFalso({ 'POST /auth/esqueci': { status: 204 } });
  render(<Esqueci />);
  escreve('E-mail', 'a@b.com');
  clica('Enviar link');
  expect(await screen.findByText('Confira seu e-mail')).toBeTruthy();
});

test('nova senha: senhas diferentes → erro no cliente; token inválido → link vencido', async () => {
  history.pushState(null, '', '/nova-senha?token=t1');
  fetchFalso({ 'POST /auth/redefinir': { status: 400, corpo: { codigo: 'TOKEN_INVALIDO', mensagem: 'x' } } });
  render(<NovaSenha />);
  escreve('Nova senha', 'senha1234');
  escreve('Repetir a senha', 'outra12345');
  clica('Salvar senha');
  expect(await screen.findByText('As senhas não são iguais.')).toBeTruthy();
  escreve('Repetir a senha', 'senha1234');
  clica('Salvar senha');
  expect(await screen.findByText('Esse link não vale mais')).toBeTruthy();
});

test('perfil salva nome, foto (comprimida em 480) e senha', async () => {
  const recarregar = vi.fn();
  const chamadas = fetchFalso({ 'PATCH /me': me, 'PUT /me/foto': me });
  const { comprimir } = await import('../postar/comprimir');
  render(<Perfil me={me} recarregar={recarregar} />);

  escreve('Nome de exibição', 'Lincoln B');
  clica('Salvar nome');
  await waitFor(() => expect(chamadas.some((c) => c.chave === 'PATCH /me')).toBe(true));
  expect(JSON.parse(chamadas[0].body as string)).toEqual({ nome: 'Lincoln B' });

  fireEvent.change(screen.getByLabelText('Trocar foto'), { target: { files: [new File(['x'], 'f.jpg', { type: 'image/jpeg' })] } });
  await waitFor(() => expect(chamadas.some((c) => c.chave === 'PUT /me/foto')).toBe(true));
  expect(comprimir).toHaveBeenCalledWith(expect.any(File), 480);
  expect((chamadas.find((c) => c.chave === 'PUT /me/foto')!.body as FormData).get('foto')).toBeInstanceOf(Blob);

  escreve('Senha atual', 'velha1234');
  escreve('Nova senha', 'nova12345');
  clica('Salvar senha');
  await waitFor(() => expect(chamadas.filter((c) => c.chave === 'PATCH /me')).toHaveLength(2));
  expect(JSON.parse(chamadas.filter((c) => c.chave === 'PATCH /me')[1].body as string)).toEqual({ senhaAtual: 'velha1234', senhaNova: 'nova12345' });
  expect(recarregar).toHaveBeenCalled();
});
