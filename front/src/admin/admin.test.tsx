import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type { Me } from '../api/cliente';
import { fetchFalso } from '../testes/fetchFalso';
import { Admin } from './Admin';

const admin: Me = { id: 'a1', nome: 'Fabio', email: 'f@x.com', avatarUrl: null, isAdmin: true, pushEnabled: false, clube: null };
const comum: Me = { ...admin, id: 'u9', isAdmin: false };
const mini = (id: string, nome: string) => ({ id, nome, escudoUrl: `/escudos/${id}.svg` });
const pedido = (id: string, nome: string, extra: object = {}) => ({
  id,
  tipo: 'ASSUMIR',
  status: 'PENDENTE',
  criadoEm: new Date(Date.now() - 2 * 3600_000).toISOString(),
  usuario: { id: 'x' + id, nome },
  clubeAtual: mini('palmeiras', 'Palmeiras'),
  clubeDesejado: mini('flamengo', 'Flamengo'),
  ...extra,
});
const clube = (id: string, nome: string, tecnico: string | null) => ({ ...mini(id, nome), tecnico: tecnico && { id: 't' + id, nome: tecnico } });

beforeEach(() => history.replaceState(null, '', '/admin'));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
const clica = (nome: string | RegExp, raiz: Pick<typeof screen, 'getByRole'> = screen) => fireEvent.click(raiz.getByRole('button', { name: nome }));

test('não-admin em /admin volta ao feed, sem aviso e sem chamar a API', async () => {
  const chamadas = fetchFalso({});
  history.replaceState(null, '', '/admin/pedidos');
  render(<Admin me={comum} caminho="/admin/pedidos" />);
  await waitFor(() => expect(location.pathname).toBe('/'));
  expect(screen.queryByRole('heading')).toBeNull();
  expect(chamadas).toHaveLength(0);
});

test('início mostra a contagem de pedidos, o código e quantos clubes têm técnico', async () => {
  fetchFalso({
    'GET /admin/trocas?status=PENDENTE': [pedido('1', 'Marcos'), pedido('2', 'Abel')],
    'GET /admin/convite': { codigo: 'OSM-2026' },
    'GET /clubes': [clube('palmeiras', 'Palmeiras', 'Lincoln'), clube('flamengo', 'Flamengo', null), clube('santos', 'Santos', 'Abel')],
  });
  render(<Admin me={admin} caminho="/admin" />);
  expect(await screen.findByText('OSM-2026')).toBeTruthy();
  expect(screen.getByRole('heading', { name: /Administração/ })).toBeTruthy();
  expect(screen.getByText('Admin')).toBeTruthy(); // rótulo das telas de admin
  expect(screen.getByLabelText('2 pedidos pendentes')).toBeTruthy();
  expect(screen.getByText('2 de 3 com técnico')).toBeTruthy();
  expect(screen.getByRole('link', { name: /Pedidos de troca/ }).getAttribute('href')).toBe('/admin/pedidos');
});

test('pedidos: cartão mostra quem, o que quer, onde está hoje e há quanto tempo', async () => {
  fetchFalso({ 'GET /admin/trocas?status=PENDENTE': [pedido('1', 'Marcos'), pedido('2', 'Abel', { tipo: 'SAIR', clubeDesejado: null, clubeAtual: null })] });
  render(<Admin me={admin} caminho="/admin/pedidos" />);
  const cartoes = await screen.findAllByRole('listitem');
  expect(cartoes[0].textContent).toContain('Marcos');
  expect(cartoes[0].textContent).toContain('quer assumir o Flamengo');
  expect(cartoes[0].textContent).toContain('hoje é técnico do Palmeiras');
  expect(cartoes[0].textContent).toContain('há 2 horas');
  expect(cartoes[1].textContent).toContain('quer sair do clube');
  expect(cartoes[1].textContent).toContain('hoje é torcedor');
});

test('admin aprova (com confirmação) → item sai da lista e aparece o aviso', async () => {
  const chamadas = fetchFalso({
    'GET /admin/trocas?status=PENDENTE': [pedido('1', 'Marcos'), pedido('2', 'Abel')],
    'POST /admin/trocas/1/aprovar': { status: 204 },
  });
  render(<Admin me={admin} caminho="/admin/pedidos" />);
  const cartao = (await screen.findByText('Marcos')).closest('li') as HTMLElement;
  clica('Aprovar', within(cartao));
  const dialogo = await screen.findByRole('alertdialog');
  expect(dialogo.textContent).toContain('Aprovar a troca de Marcos?');
  expect(dialogo.textContent).toContain('Marcos sai do Palmeiras e assume o Flamengo.');
  expect(chamadas.some((c) => c.chave.startsWith('POST'))).toBe(false); // nada antes de confirmar
  expect(document.activeElement).toBe(within(dialogo).getByRole('button', { name: 'Voltar' })); // foco no seguro
  clica('Aprovar', within(dialogo));
  await waitFor(() => expect(screen.queryByText('Marcos')).toBeNull());
  expect(chamadas.map((c) => c.chave)).toContain('POST /admin/trocas/1/aprovar');
  expect(screen.getByRole('status').textContent).toContain('Troca aprovada. Marcos agora é técnico do Flamengo.');
  expect(screen.getByText('Abel')).toBeTruthy();
  expect(screen.queryByRole('alertdialog')).toBeNull();
});

test('Voltar (e Esc) fecham o diálogo sem decidir', async () => {
  const chamadas = fetchFalso({ 'GET /admin/trocas?status=PENDENTE': [pedido('1', 'Marcos')] });
  render(<Admin me={admin} caminho="/admin/pedidos" />);
  clica('Recusar', within((await screen.findByText('Marcos')).closest('li') as HTMLElement));
  const d = await screen.findByRole('alertdialog');
  expect(d.textContent).toContain('Recusar o pedido de Marcos?');
  clica('Voltar', within(d));
  expect(screen.queryByRole('alertdialog')).toBeNull();
  clica('Recusar', within(screen.getByText('Marcos').closest('li') as HTMLElement));
  fireEvent.keyDown(await screen.findByRole('alertdialog'), { key: 'Escape' });
  expect(screen.queryByRole('alertdialog')).toBeNull();
  expect(chamadas.some((c) => c.chave.startsWith('POST'))).toBe(false);
});

test('recusar confirma, chama /recusar e o cartão some', async () => {
  const chamadas = fetchFalso({ 'GET /admin/trocas?status=PENDENTE': [pedido('1', 'Marcos')], 'POST /admin/trocas/1/recusar': { status: 204 } });
  render(<Admin me={admin} caminho="/admin/pedidos" />);
  clica('Recusar', within((await screen.findByText('Marcos')).closest('li') as HTMLElement));
  clica('Recusar', within(await screen.findByRole('alertdialog')));
  await waitFor(() => expect(chamadas.map((c) => c.chave)).toContain('POST /admin/trocas/1/recusar'));
  expect((await screen.findByText('Sem pedidos pendentes')).tagName).toBeTruthy();
  expect(screen.getByRole('status').textContent).toContain('Pedido recusado.');
});

test('409 na aprovação → "Clube ocupado, recuse ou espere"; Aprovar trava só nesse cartão e o pedido fica', async () => {
  fetchFalso({
    'GET /admin/trocas?status=PENDENTE': [pedido('1', 'Marcos'), pedido('2', 'Abel')],
    'POST /admin/trocas/1/aprovar': { status: 409, corpo: { codigo: 'CLUBE_OCUPADO', mensagem: 'x' } },
  });
  render(<Admin me={admin} caminho="/admin/pedidos" />);
  const cartao = (await screen.findByText('Marcos')).closest('li') as HTMLElement;
  clica('Aprovar', within(cartao));
  clica('Aprovar', within(await screen.findByRole('alertdialog')));
  await waitFor(() => expect(within(cartao).getByRole('alert')).toBeTruthy());
  expect(within(cartao).getByRole('alert').textContent).toMatch(/clube ocupado/i);
  expect(within(cartao).getByRole('alert').textContent).toMatch(/O Flamengo já tem técnico/);
  expect(within(cartao).getByRole('alert').textContent).toMatch(/recuse ou espere/i);
  expect((within(cartao).getByRole('button', { name: 'Aprovar' }) as HTMLButtonElement).disabled).toBe(true);
  expect((within(cartao).getByRole('button', { name: 'Recusar' }) as HTMLButtonElement).disabled).toBe(false);
  const outro = screen.getByText('Abel').closest('li') as HTMLElement;
  expect((within(outro).getByRole('button', { name: 'Aprovar' }) as HTMLButtonElement).disabled).toBe(false);
  expect(screen.queryByRole('alertdialog')).toBeNull();
});

test('409 TROCA_JA_DECIDIDA → aviso e o cartão some', async () => {
  fetchFalso({
    'GET /admin/trocas?status=PENDENTE': [pedido('1', 'Marcos')],
    'POST /admin/trocas/1/aprovar': { status: 409, corpo: { codigo: 'TROCA_JA_DECIDIDA', mensagem: 'x' } },
  });
  render(<Admin me={admin} caminho="/admin/pedidos" />);
  clica('Aprovar', within((await screen.findByText('Marcos')).closest('li') as HTMLElement));
  clica('Aprovar', within(await screen.findByRole('alertdialog')));
  await waitFor(() => expect(screen.queryByText('Marcos')).toBeNull());
  expect(screen.getByRole('status').textContent).toContain('Esse pedido já foi decidido.');
});

test('pedidos: vazio e erro com "Tentar de novo"', async () => {
  fetchFalso({ 'GET /admin/trocas?status=PENDENTE': [] });
  render(<Admin me={admin} caminho="/admin/pedidos" />);
  expect(await screen.findByText('Sem pedidos pendentes')).toBeTruthy();
  expect(screen.getByText('Quando alguém pedir um clube, aparece aqui e você recebe um aviso.')).toBeTruthy();
  cleanup();

  let n = 0;
  fetchFalso({ 'GET /admin/trocas?status=PENDENTE': () => (n++ === 0 ? { status: 500, corpo: {} } : [pedido('1', 'Marcos')]) });
  render(<Admin me={admin} caminho="/admin/pedidos" />);
  expect(await screen.findByText('Não deu para carregar os pedidos')).toBeTruthy();
  clica('Tentar de novo');
  expect(await screen.findByText('Marcos')).toBeTruthy();
});

test('convite: mostra o código, copia (vira "Código copiado") e troca mostrando o código novo para copiar', async () => {
  const escrever = vi.fn(async () => undefined);
  vi.stubGlobal('navigator', { clipboard: { writeText: escrever } });
  const chamadas = fetchFalso({ 'GET /admin/convite': { codigo: 'OSM-2026' }, 'PUT /admin/convite': { codigo: 'COPA-2027' } });
  render(<Admin me={admin} caminho="/admin/convite" />);
  expect(await screen.findByText('OSM-2026')).toBeTruthy();
  clica('Copiar código');
  await waitFor(() => expect(escrever).toHaveBeenCalledWith('OSM-2026'));
  expect(await screen.findByRole('button', { name: 'Código copiado' })).toBeTruthy();

  clica('Trocar código');
  const campo = await screen.findByLabelText('Novo código');
  expect(screen.getByText('O código antigo para de valer na hora. Quem já tem conta continua entrando.')).toBeTruthy();
  fireEvent.change(campo, { target: { value: 'copa-2027' } });
  expect((campo as HTMLInputElement).value).toBe('COPA-2027'); // maiúsculas
  clica('Trocar código', within(screen.getByRole('dialog')));
  expect(await screen.findByText('COPA-2027')).toBeTruthy();
  expect(screen.queryByText('OSM-2026')).toBeNull();
  expect(JSON.parse(chamadas.find((c) => c.chave === 'PUT /admin/convite')!.body as string)).toEqual({ codigo: 'COPA-2027' });
  clica('Copiar código');
  await waitFor(() => expect(escrever).toHaveBeenLastCalledWith('COPA-2027'));
});

test('convite novo com menos de 4 caracteres → erro no campo e nada é enviado', async () => {
  const chamadas = fetchFalso({ 'GET /admin/convite': { codigo: 'OSM-2026' } });
  render(<Admin me={admin} caminho="/admin/convite" />);
  await screen.findByText('OSM-2026');
  clica('Trocar código');
  fireEvent.change(await screen.findByLabelText('Novo código'), { target: { value: 'abc' } });
  clica('Trocar código', within(screen.getByRole('dialog')));
  expect(await screen.findByText('Use pelo menos 4 caracteres.')).toBeTruthy();
  expect(chamadas.some((c) => c.chave.startsWith('PUT'))).toBe(false);
});

test('clubes: técnico → diálogo e "Tirar técnico" libera a vaga; clube sem técnico mostra "Vaga aberta" e não abre nada', async () => {
  const chamadas = fetchFalso({
    'GET /clubes': [clube('palmeiras', 'Palmeiras', 'Lincoln'), clube('flamengo', 'Flamengo', null)],
    'POST /admin/clubes/palmeiras/remover-tecnico': { status: 204 },
  });
  render(<Admin me={admin} caminho="/admin/clubes" />);
  expect(await screen.findByText('Vaga aberta')).toBeTruthy();
  expect(screen.queryByRole('button', { name: /Flamengo/ })).toBeNull();
  clica(/Palmeiras/);
  const d = await screen.findByRole('alertdialog');
  expect(d.textContent).toContain('Tirar Lincoln do Palmeiras?');
  clica('Tirar técnico', within(d));
  await waitFor(() => expect(chamadas.map((c) => c.chave)).toContain('POST /admin/clubes/palmeiras/remover-tecnico'));
  await waitFor(() => expect(screen.getAllByText('Vaga aberta')).toHaveLength(2));
  expect(screen.getByRole('status').textContent).toContain('Lincoln saiu do Palmeiras.');
});

test('convite: o campo limita a 64, e o 400 DADOS_INVALIDOS do servidor vira erro no campo (sem aviso de conexão)', async () => {
  fetchFalso({
    'GET /admin/convite': { codigo: 'OSM-2026' },
    'PUT /admin/convite': { status: 400, corpo: { codigo: 'DADOS_INVALIDOS', mensagem: 'x', campos: ['codigo'] } },
  });
  render(<Admin me={admin} caminho="/admin/convite" />);
  await screen.findByText('OSM-2026');
  clica('Trocar código');
  const campo = (await screen.findByLabelText('Novo código')) as HTMLInputElement;
  expect(campo.maxLength).toBe(64);
  fireEvent.change(campo, { target: { value: 'abcde' } });
  clica('Trocar código', within(screen.getByRole('dialog')));
  expect(await screen.findByText('Use de 4 a 64 caracteres.')).toBeTruthy();
  expect(screen.queryByText(/Confira a conexão/)).toBeNull();
  // colado com mais de 64 (se o navegador não cortar): erro de tamanho no campo, sem chamar a API
  fireEvent.change(campo, { target: { value: 'A'.repeat(65) } });
  clica('Trocar código', within(screen.getByRole('dialog')));
  expect(await screen.findByText('Use no máximo 64 caracteres.')).toBeTruthy();
});

test('o foco volta ao título quando o botão que abriu o diálogo sumiu (pedido aprovado)', async () => {
  fetchFalso({ 'GET /admin/trocas?status=PENDENTE': [pedido('1', 'Marcos'), pedido('2', 'Abel')], 'POST /admin/trocas/1/aprovar': { status: 204 } });
  render(<Admin me={admin} caminho="/admin/pedidos" />);
  clica('Aprovar', within((await screen.findByText('Marcos')).closest('li') as HTMLElement));
  clica('Aprovar', within(await screen.findByRole('alertdialog')));
  await waitFor(() => expect(screen.queryByText('Marcos')).toBeNull());
  expect(document.activeElement).toBe(screen.getByRole('heading', { level: 1, name: 'Pedidos de troca' }));
});

test('o foco volta ao botão de origem quando ele continua na tela (Voltar)', async () => {
  fetchFalso({ 'GET /admin/trocas?status=PENDENTE': [pedido('1', 'Marcos')] });
  render(<Admin me={admin} caminho="/admin/pedidos" />);
  const aprovar = within((await screen.findByText('Marcos')).closest('li') as HTMLElement).getByRole('button', { name: 'Aprovar' });
  aprovar.focus();
  fireEvent.click(aprovar);
  clica('Voltar', within(await screen.findByRole('alertdialog')));
  expect(document.activeElement).toBe(aprovar);
});
