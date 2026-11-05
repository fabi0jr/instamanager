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
  expect(screen.getByText('Preencha os dois lados ou deixe os dois vazios.')).toBeTruthy(); // um lado só
  expect((screen.getByRole('button', { name: 'Salvar jogos' }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.change(screen.getByLabelText('Gols do visitante, jogo 1'), { target: { value: '0' } });
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
  const confirma = screen.getByRole('alertdialog');
  expect(confirma.textContent).toContain('Fechar a rodada 1?');
  expect(confirma.textContent).toContain('Depois você vê a prévia do resumo da CBF');
  expect(chamadas.some((x) => x.chave === 'POST /admin/rodadas/1/fechar')).toBe(false); // nada antes de confirmar
  fireEvent.click(within(confirma).getByRole('button', { name: 'Fechar rodada' }));
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
  fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Fechar rodada' }));
  await screen.findByText('Frase 1');
  fireEvent.click(screen.getByRole('button', { name: /Sortear de novo/ }));
  await screen.findByText('Frase 2'); // sem edição: troca sem perguntar
  const barra = document.querySelector('.acao-fixa')!; // as 3 ações ficam sempre à vista, na barra fixa
  for (const n of [/Sortear de novo/, /Editar texto/, /^Publicar resumo$/]) expect(within(barra as HTMLElement).getByRole('button', { name: n })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: /Editar texto/ }));
  const campo = screen.getByLabelText('Texto do post') as HTMLTextAreaElement;
  expect(campo.maxLength).toBe(500);
  fireEvent.change(campo, { target: { value: 'Texto do admin' } });
  expect(screen.getByText('14/500')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: /Sortear de novo/ })); // editado: pede confirmação
  expect(screen.getByRole('alertdialog').textContent).toContain('Descartar o texto editado?');
  fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Cancelar' }));
  fireEvent.click(screen.getByRole('button', { name: 'Publicar resumo' }));
  await waitFor(() => expect(chamadas.some((x) => x.chave === 'POST /admin/rodadas/1/publicar')).toBe(true));
  expect(JSON.parse(chamadas.find((x) => x.chave === 'POST /admin/rodadas/1/publicar')!.body as string)).toEqual({ texto: 'Texto do admin', citados: ['tflamengo'] });
  await waitFor(() => expect(location.pathname).toBe('/admin/rodadas'));
});

test('rodada fechada sem resumo mostra "Publicar resumo" (abre a prévia) e nunca diz que já saiu', async () => {
  const chamadas = fetchFalso({
    'GET /liga/rodadas': rodadas(true, [jogo]),
    'GET /clubes': clubes,
    'POST /admin/rodadas/1/previa': { status: 201, corpo: { texto: 'Resumo da vez', citados: [] } },
  });
  tela('/admin/rodadas/1');
  expect(await screen.findByText(/O resumo da CBF ainda não foi publicado/)).toBeTruthy();
  expect(screen.queryByText(/já saiu/)).toBeNull();
  expect(screen.queryByText('Resumo publicado')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Publicar resumo' }));
  expect(await screen.findByText('Resumo da vez')).toBeTruthy();
  expect(chamadas.at(-1)!.chave).toBe('POST /admin/rodadas/1/previa');
  expect(screen.getByRole('button', { name: 'Agora não: a rodada já está fechada' })).toBeTruthy();
  expect(screen.getByText(/já está fechada/)).toBeTruthy();
});

test('rodada fechada com resumo mostra "Resumo publicado" com link para o post', async () => {
  fetchFalso({ 'GET /liga/rodadas': [{ ...rodadas(true, [jogo])[0], resumoPublicado: true, resumoPostId: 'post9' }], 'GET /clubes': clubes });
  tela('/admin/rodadas/1');
  expect((await screen.findByRole('link', { name: 'Resumo publicado' })).getAttribute('href')).toBe('/p/post9');
  expect(screen.queryByRole('button', { name: 'Publicar resumo' })).toBeNull();
});

test('publicar: 409 RESUMO_JA_PUBLICADO conta como sucesso (sem erro, volta à lista)', async () => {
  fetchFalso({
    'GET /liga/rodadas': rodadas(true, [jogo]),
    'GET /clubes': clubes,
    'POST /admin/rodadas/1/previa': { status: 201, corpo: { texto: 'Resumo', citados: [] } },
    'POST /admin/rodadas/1/publicar': { status: 409, corpo: { codigo: 'RESUMO_JA_PUBLICADO' } },
  });
  tela('/admin/rodadas/1');
  fireEvent.click(await screen.findByRole('button', { name: 'Publicar resumo' }));
  await screen.findByText('Resumo');
  fireEvent.click(screen.getByRole('button', { name: 'Publicar resumo' }));
  await waitFor(() => expect(location.pathname).toBe('/admin/rodadas'));
  expect(screen.queryByText('Não deu para publicar. Tente de novo.')).toBeNull();
});

test('jogo agendado (gols vazios) vai com gols nulos, o prazo vai em ISO, e fechar com jogo sem placar avisa quantos faltam', async () => {
  const chamadas = fetchFalso({ 'GET /liga/rodadas': rodadas(false), 'GET /clubes': clubes, 'PUT /admin/rodadas/1/jogos': { status: 204 }, 'PUT /admin/rodadas/1/prazo': { status: 204 } });
  tela('/admin/rodadas/1');
  fireEvent.click(await screen.findByRole('button', { name: 'Adicionar jogo' }));
  fireEvent.change(screen.getByLabelText('Mandante do jogo 1'), { target: { value: 'palmeiras' } });
  fireEvent.change(screen.getByLabelText('Visitante do jogo 1'), { target: { value: 'flamengo' } });
  fireEvent.click(screen.getByRole('button', { name: 'Fechar rodada' }));
  expect(await screen.findByText('Faltam placares em 1 jogo. Preencha para fechar a rodada.')).toBeTruthy();
  expect(document.querySelector('.cartao-jogo.pendente')).not.toBeNull();
  expect(chamadas.some((x) => x.chave.endsWith('/fechar'))).toBe(false);
  fireEvent.change(screen.getByLabelText('Prazo de palpite'), { target: { value: '2099-11-14T19:00' } });
  fireEvent.click(screen.getByRole('button', { name: 'Salvar jogos' }));
  await waitFor(() => expect(chamadas.some((x) => x.chave === 'PUT /admin/rodadas/1/prazo')).toBe(true));
  expect(JSON.parse(chamadas.find((x) => x.chave === 'PUT /admin/rodadas/1/jogos')!.body as string)).toEqual({ jogos: [{ mandanteId: 'palmeiras', visitanteId: 'flamengo', golsMandante: null, golsVisitante: null }] });
  expect(JSON.parse(chamadas.find((x) => x.chave === 'PUT /admin/rodadas/1/prazo')!.body as string).prazoPalpite).toMatch(/^2099-11-1[45]T/);
});
