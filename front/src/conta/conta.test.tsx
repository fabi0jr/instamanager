import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { fetchFalso } from '../testes/fetchFalso';
import { Cadastro } from './Cadastro';
import { Entrar } from './Entrar';
import { Esqueci } from './Esqueci';
import { NovaSenha } from './NovaSenha';
import { Perfil } from './Perfil';
import { TrocarSenha } from './TrocarSenha';

vi.mock('../postar/comprimir', () => ({ comprimir: vi.fn(async () => ({ blob: new Blob(['j']), largura: 480, altura: 480 })), ErroImagem: class extends Error {} }));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const escreve = (rotulo: string, valor: string) => fireEvent.change(screen.getByLabelText(rotulo), { target: { value: valor } });
const clica = (nome: string | RegExp) => fireEvent.click(screen.getByRole('button', { name: nome }));
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

test('perfil salva nome (folha) e foto (comprimida em 480)', async () => {
  const recarregar = vi.fn();
  const chamadas = fetchFalso({ 'GET /trocas/minhas': [], 'PATCH /me': me, 'PUT /me/foto': me });
  const { comprimir } = await import('../postar/comprimir');
  render(<Perfil me={me} recarregar={recarregar} />);

  clica(/Nome de exibição/);
  escreve('Nome de exibição', 'Lincoln B');
  clica('Salvar nome');
  await waitFor(() => expect(chamadas.some((c) => c.chave === 'PATCH /me')).toBe(true));
  expect(JSON.parse(chamadas.find((c) => c.chave === 'PATCH /me')!.body as string)).toEqual({ nome: 'Lincoln B' });
  expect((await screen.findByRole('status')).textContent).toBe('Nome salvo.');

  fireEvent.change(screen.getByLabelText('Trocar foto'), { target: { files: [new File(['x'], 'f.jpg', { type: 'image/jpeg' })] } });
  await waitFor(() => expect(chamadas.some((c) => c.chave === 'PUT /me/foto')).toBe(true));
  expect(comprimir).toHaveBeenCalledWith(expect.any(File), 480);
  expect((chamadas.find((c) => c.chave === 'PUT /me/foto')!.body as FormData).get('foto')).toBeInstanceOf(Blob);
  expect(recarregar).toHaveBeenCalled();
});

test('perfil: foto recusada pelo servidor mostra o aviso', async () => {
  fetchFalso({ 'GET /trocas/minhas': [], 'PUT /me/foto': { status: 400, corpo: { codigo: 'IMAGEM_INVALIDA', mensagem: 'x' } } });
  render(<Perfil me={me} recarregar={() => {}} />);
  fireEvent.change(screen.getByLabelText('Trocar foto'), { target: { files: [new File(['x'], 'f.jpg')] } });
  expect((await screen.findByRole('alert')).textContent).toContain('Não deu para ler essa imagem. Escolha outra foto.');
});

test('perfil: interruptor de notificações grava na hora e desfaz se falhar', async () => {
  const chamadas = fetchFalso({ 'GET /trocas/minhas': [], 'PATCH /me': { status: 500 } });
  render(<Perfil me={me} recarregar={() => {}} />);
  const chave = screen.getByRole('switch', { name: 'Notificações' });
  expect(chave.getAttribute('aria-checked')).toBe('false');
  fireEvent.click(chave);
  expect(chave.getAttribute('aria-checked')).toBe('true'); // otimista
  await waitFor(() => expect(chave.getAttribute('aria-checked')).toBe('false'));
  expect(JSON.parse(chamadas.find((c) => c.chave === 'PATCH /me')!.body as string)).toEqual({ pushEnabled: true });
  expect(screen.getByRole('status').textContent).toBe('Não deu para salvar. Tente de novo.');
});

test('perfil do técnico: clube, Trocar de clube → /trocar; admin só para admin', async () => {
  const clube = { id: 'palmeiras', nome: 'Palmeiras', escudoUrl: '/escudos/palmeiras.svg' };
  fetchFalso({ 'GET /trocas/minhas': [] });
  const { rerender } = render(<Perfil me={{ ...me, clube }} recarregar={() => {}} />);
  expect(screen.getByRole('link', { name: /Palmeiras/ }).getAttribute('href')).toBe('/c/palmeiras');
  expect(screen.getByRole('link', { name: /Trocar de clube/ }).getAttribute('href')).toBe('/trocar');
  expect(screen.queryByRole('link', { name: /Administração/ })).toBeNull();
  rerender(<Perfil me={{ ...me, clube, isAdmin: true }} recarregar={() => {}} />);
  expect(screen.getByRole('link', { name: /Administração/ }).getAttribute('href')).toBe('/admin');
});

test('perfil do torcedor: "Sem clube" e Pedir um clube → /trocar', async () => {
  fetchFalso({ 'GET /trocas/minhas': [] });
  render(<Perfil me={me} recarregar={() => {}} />);
  expect(screen.getByText('Você vê, curte e comenta, mas não posta.')).toBeTruthy();
  expect(screen.getByRole('link', { name: /Pedir um clube/ }).getAttribute('href')).toBe('/trocar');
  expect(screen.getByText('Torcedor, sem clube')).toBeTruthy();
});

test('perfil com pedido pendente mostra "Pedido pendente" sem link para trocar', async () => {
  fetchFalso({
    'GET /trocas/minhas': [{ id: 't1', tipo: 'ASSUMIR', status: 'PENDENTE', clubeId: 'flamengo' }],
    'GET /clubes': [{ id: 'flamengo', nome: 'Flamengo', escudoUrl: '', tecnico: null }],
  });
  render(<Perfil me={me} recarregar={() => {}} />);
  expect(await screen.findByText('Assumir o Flamengo. Aguardando o admin.')).toBeTruthy();
  expect(screen.getByText('Pedido pendente')).toBeTruthy();
  expect(screen.queryByRole('link', { name: /Pedir um clube/ })).toBeNull();
});

test('trocar senha: SENHA_ATUAL_INVALIDA vai no campo e sucesso avisa que saiu dos outros aparelhos', async () => {
  let ok = false;
  const chamadas = fetchFalso({ 'PATCH /me': () => (ok ? me : { status: 400, corpo: { codigo: 'SENHA_ATUAL_INVALIDA', mensagem: 'x' } }) });
  render(<TrocarSenha />);
  escreve('Senha atual', 'velha1234');
  escreve('Nova senha', 'nova12345');
  clica('Salvar senha');
  expect(await screen.findByText('Senha atual incorreta.')).toBeTruthy();
  ok = true;
  clica('Salvar senha');
  expect(await screen.findByText('Você saiu dos outros aparelhos.')).toBeTruthy();
  expect(JSON.parse(chamadas[1].body as string)).toEqual({ senhaAtual: 'velha1234', senhaNova: 'nova12345' });
});

test('400 DADOS_INVALIDOS no entrar mostra o erro no campo, não "confira a conexão"', async () => {
  fetchFalso({ 'POST /auth/entrar': { status: 400, corpo: { codigo: 'DADOS_INVALIDOS', mensagem: 'x', campos: ['email', 'senha'] } } });
  render(<Entrar aoEntrar={() => {}} />);
  clica('Entrar');
  expect(await screen.findByText('Digite seu e-mail.')).toBeTruthy();
  expect(screen.getByText('Digite sua senha.')).toBeTruthy();
  expect(screen.queryByText(/Confira a conexão/)).toBeNull();
  expect(document.activeElement).toBe(screen.getByLabelText('E-mail'));
});

test('400 DADOS_INVALIDOS no esqueci mostra o erro no campo e-mail', async () => {
  fetchFalso({ 'POST /auth/esqueci': { status: 400, corpo: { codigo: 'DADOS_INVALIDOS', mensagem: 'x', campos: ['email'] } } });
  render(<Esqueci />);
  clica('Enviar link');
  expect(await screen.findByText('Digite seu e-mail.')).toBeTruthy();
});

test('lista de clubes: o foco acompanha as setas (roving tabindex)', async () => {
  fetchFalso({ 'GET /clubes?livres=1': livres });
  await ateOClube();
  const radios = screen.getAllByRole('radio');
  expect(radios.map((r) => r.getAttribute('tabindex'))).toEqual(['0', '-1', '-1']);
  fireEvent.keyDown(screen.getByRole('radiogroup'), { key: 'ArrowDown' });
  expect(document.activeElement).toBe(radios[0]);
  expect(radios.map((r) => r.getAttribute('tabindex'))).toEqual(['0', '-1', '-1']);
  fireEvent.keyDown(screen.getByRole('radiogroup'), { key: 'ArrowDown' });
  expect(document.activeElement).toBe(radios[1]);
  expect(radios.map((r) => r.getAttribute('tabindex'))).toEqual(['-1', '0', '-1']);
});

test('aviso de clube ocupado some ao voltar ao passo 2', async () => {
  fetchFalso({ 'GET /clubes?livres=1': livres, 'POST /auth/cadastro': { status: 409, corpo: { codigo: 'CLUBE_OCUPADO', mensagem: 'x' } } });
  await ateOClube();
  fireEvent.click(screen.getByRole('radio', { name: 'Palmeiras' }));
  clica('Criar conta');
  await screen.findByRole('alert');
  clica('‹ Voltar');
  expect(screen.queryByRole('alert')).toBeNull();
});
