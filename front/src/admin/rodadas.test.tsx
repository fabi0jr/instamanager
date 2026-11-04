import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type { Me } from '../api/cliente';
import { fetchFalso } from '../testes/fetchFalso';
import { Admin } from './Admin';

const admin: Me = { id: 'a1', nome: 'Fabio', email: 'f@x.com', avatarUrl: null, isAdmin: true, pushEnabled: false, clube: null };
const c = (id: string, nome: string) => ({ id, nome, escudoUrl: `/escudos/${id}.svg`, tecnico: { id: 't' + id, nome: 'T' + nome } });
const clubes = [c('palmeiras', 'Palmeiras'), c('flamengo', 'Flamengo'), c('santos', 'Santos')];
const jogo = { id: 'j1', mandante: clubes[0], visitante: clubes[1], golsMandante: 2, golsVisitante: 1 };
const rodadas = (fechada: boolean, jogos: unknown[] = []) => [{ numero: 1, fechada, jogos }, { numero: 2, fechada: false, jogos: [] }];

beforeEach(() => history.replaceState(null, '', '/admin/rodadas/1'));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const tela = (caminho: string) => render(<Admin me={admin} caminho={caminho} />);

test('lançar jogos: escolher mandante e visitante só entre clubes sem jogo na rodada, placar 0–99', async () => {
  const chamadas = fetchFalso({ 'GET /liga/rodadas': rodadas(false), 'GET /clubes': clubes, 'PUT /admin/rodadas/1/jogos': { status: 204 } });
  tela('/admin/rodadas/1');
  fireEvent.click(await screen.findByRole('button', { name: 'Adicionar jogo' }));
  fireEvent.click(screen.getByRole('button', { name: 'Adicionar jogo' }));
  fireEvent.change(screen.getByLabelText('Mandante do jogo 1'), { target: { value: 'palmeiras' } });
  fireEvent.change(screen.getByLabelText('Visitante do jogo 1'), { target: { value: 'flamengo' } });
  // no jogo 2, quem já joga no 1 fica desabilitado
  const op = (rotulo: string, nome: string) => within(screen.getByLabelText(rotulo)).getByRole('option', { name: new RegExp(nome) }) as HTMLOptionElement;
  expect(op('Mandante do jogo 2', 'Palmeiras').disabled).toBe(true);
  expect(op('Mandante do jogo 2', 'Palmeiras').textContent).toContain('já joga nesta rodada');
  expect(op('Visitante do jogo 2', 'Flamengo').disabled).toBe(true);
  expect(op('Mandante do jogo 2', 'Santos').disabled).toBe(false);
  fireEvent.click(screen.getByRole('button', { name: 'Remover jogo 2' }));
  const gm = screen.getByLabelText('Gols do mandante, jogo 1') as HTMLInputElement;
  expect(gm.min).toBe('0'); expect(gm.max).toBe('99');
  fireEvent.change(gm, { target: { value: '150' } });
  expect(screen.getByText('Placar de 0 a 99')).toBeTruthy();
  expect((screen.getByRole('button', { name: 'Salvar jogos' }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.change(gm, { target: { value: '3' } });
  fireEvent.click(screen.getByRole('button', { name: 'Salvar jogos' }));
  await waitFor(() => expect(chamadas.some((x) => x.chave === 'PUT /admin/rodadas/1/jogos')).toBe(true));
  expect(JSON.parse(chamadas.find((x) => x.chave === 'PUT /admin/rodadas/1/jogos')!.body as string)).toEqual({ jogos: [{ mandanteId: 'palmeiras', visitanteId: 'flamengo', golsMandante: 3, golsVisitante: 0 }] });
});

test('fechar rodada sem jogo pede ao menos um jogo', async () => {
  fetchFalso({ 'GET /liga/rodadas': rodadas(false), 'GET /clubes': clubes });
  tela('/admin/rodadas/1');
  fireEvent.click(await screen.findByRole('button', { name: 'Fechar rodada' }));
  expect(await screen.findByText('Lance ao menos um jogo')).toBeTruthy();
});

test('fechar e reabrir com confirmação', async () => {
  let fechada = false;
  const chamadas = fetchFalso({
    'GET /liga/rodadas': () => rodadas(fechada, [jogo]),
    'GET /clubes': clubes,
    'PUT /admin/rodadas/1/jogos': { status: 204 },
    'POST /admin/rodadas/1/fechar': () => { fechada = true; return { status: 204 }; },
    'POST /admin/rodadas/1/previa': { status: 201, corpo: { texto: 'Rodada boa', citados: [] } },
    'POST /admin/rodadas/1/reabrir': () => { fechada = false; return { status: 204 }; },
  });
  tela('/admin/rodadas/1');
  fireEvent.click(await screen.findByRole('button', { name: 'Fechar rodada' }));
  expect(await screen.findByText('Rodada boa')).toBeTruthy(); // abre a prévia, não "fecha direto"
  expect(chamadas.map((x) => x.chave)).toEqual(['GET /liga/rodadas', 'GET /clubes', 'PUT /admin/rodadas/1/jogos', 'POST /admin/rodadas/1/fechar', 'POST /admin/rodadas/1/previa']);
  cleanup();
  fechada = true;
  tela('/admin/rodadas/1');
  fireEvent.click(await screen.findByRole('button', { name: 'Reabrir para editar' }));
  const dialogo = screen.getByRole('alertdialog');
  expect(dialogo.textContent).toContain('A tabela é recalculada sem esses jogos');
  expect(chamadas.some((x) => x.chave === 'POST /admin/rodadas/1/reabrir')).toBe(false); // só confirma no botão
  fireEvent.click(within(dialogo).getByRole('button', { name: 'Reabrir rodada' }));
  await waitFor(() => expect(chamadas.some((x) => x.chave === 'POST /admin/rodadas/1/reabrir')).toBe(true));
  expect(await screen.findByRole('button', { name: 'Fechar rodada' })).toBeTruthy();
});

test('prévia do bot com Sortear de novo, Editar (até 500) e Publicar', async () => {
  let n = 0;
  const chamadas = fetchFalso({
    'GET /liga/rodadas': rodadas(false, [jogo]),
    'GET /clubes': clubes,
    'PUT /admin/rodadas/1/jogos': { status: 204 },
    'POST /admin/rodadas/1/fechar': { status: 204 },
    'POST /admin/rodadas/1/previa': () => ({ status: 201, corpo: { texto: `Frase ${++n}`, citados: ['tflamengo'] } }),
    'POST /admin/rodadas/1/publicar': { status: 201, corpo: {} },
  });
  tela('/admin/rodadas/1');
  fireEvent.click(await screen.findByRole('button', { name: 'Fechar rodada' }));
  await screen.findByText('Frase 1');
  fireEvent.click(screen.getByRole('button', { name: /Sortear de novo/ }));
  await screen.findByText('Frase 2'); // sem edição: troca sem perguntar
  fireEvent.click(screen.getByRole('button', { name: /Editar texto/ }));
  const campo = screen.getByLabelText('Texto do post') as HTMLTextAreaElement;
  expect(campo.maxLength).toBe(500);
  fireEvent.change(campo, { target: { value: 'Texto do admin' } });
  expect(screen.getByText('14/500')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: /Sortear de novo/ })); // editado: pede confirmação
  expect(screen.getByRole('alertdialog').textContent).toContain('Descartar o texto editado?');
  fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Cancelar' }));
  fireEvent.click(screen.getByRole('button', { name: 'Fechar e publicar' }));
  await waitFor(() => expect(chamadas.some((x) => x.chave === 'POST /admin/rodadas/1/publicar')).toBe(true));
  expect(JSON.parse(chamadas.find((x) => x.chave === 'POST /admin/rodadas/1/publicar')!.body as string)).toEqual({ texto: 'Texto do admin', citados: ['tflamengo'] });
  await waitFor(() => expect(location.pathname).toBe('/admin/rodadas'));
});

test('criar votação (título, tipo, opções, prazo) e encerrar mostra o selo criado', async () => {
  const chamadas = fetchFalso({
    'GET /clubes': clubes,
    'POST /admin/votacoes': { status: 201, corpo: {} },
  });
  history.replaceState(null, '', '/admin/votacoes/nova');
  tela('/admin/votacoes/nova');
  const criar = await screen.findByRole('button', { name: 'Criar votação' }) as HTMLButtonElement;
  await screen.findByText('Palmeiras ✕'.replace(' ✕', ''), { exact: false });
  expect(criar.disabled).toBe(true);
  fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Clube do mês' } });
  fireEvent.click(screen.getByRole('button', { name: 'Remover Santos' }));
  fireEvent.change(screen.getByLabelText('Prazo'), { target: { value: '2099-01-01T10:00' } });
  expect(criar.disabled).toBe(false);
  fireEvent.click(criar);
  await waitFor(() => expect(chamadas.some((x) => x.chave === 'POST /admin/votacoes')).toBe(true));
  const corpo = JSON.parse(chamadas.find((x) => x.chave === 'POST /admin/votacoes')!.body as string);
  expect(corpo).toMatchObject({ titulo: 'Clube do mês', tipo: 'CLUBE', opcoes: ['palmeiras', 'flamengo'] });
  expect(corpo.prazo).toBe(new Date('2099-01-01T10:00').toISOString());
});

test('encerrar votação mostra o selo criado', async () => {
  const v = { id: 'v1', titulo: 'Clube do mês', tipo: 'CLUBE', prazo: new Date(Date.now() + 86400_000).toISOString(), aberta: true, encerrada: false, opcoes: [{ id: 'flamengo', rotulo: 'Flamengo' }, { id: 'santos', rotulo: 'Santos' }], meuVoto: null };
  fetchFalso({ 'GET /votacoes': [v], 'POST /admin/votacoes/v1/encerrar': { status: 201, corpo: { ...v, encerrada: true, resultado: [{ opcao: 'flamengo', rotulo: 'Flamengo', votos: 5 }, { opcao: 'santos', rotulo: 'Santos', votos: 2 }] } } });
  history.replaceState(null, '', '/admin/votacoes');
  tela('/admin/votacoes');
  fireEvent.click(await screen.findByRole('button', { name: 'Encerrar' }));
  fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Encerrar agora' }));
  expect(await screen.findByText('Votação encerrada. Selo criado para Flamengo.')).toBeTruthy();
});
