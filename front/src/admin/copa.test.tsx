import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type { Me } from '../api/cliente';
import { fetchFalso } from '../testes/fetchFalso';
import { Admin } from './Admin';

const admin: Me = { id: 'a1', nome: 'Fabio', email: 'f@x.com', avatarUrl: null, isAdmin: true, pushEnabled: false, clube: null };
const c = (id: string, nome: string) => ({ id, nome, escudoUrl: `/escudos/${id}.svg`, tecnico: null });
const clubes = [c('santos', 'Santos'), c('vasco', 'Vasco'), c('flamengo', 'Flamengo'), c('cbf', 'CBF')];
const fase = (extra = {}) => ({ id: 'f1', nome: 'Oitavas', ordem: 1, prazoPalpite: null, fechada: false, resumoPublicado: false, resumoPostId: null, ...extra });
const vazio = { golsMandante: null, golsVisitante: null, penaltisMandante: null, penaltisVisitante: null, vencedor: null };

beforeEach(() => history.replaceState(null, '', '/admin/copa'));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const tela = (caminho: string) => render(<Admin me={admin} caminho={caminho} />);
const muda = (rotulo: string, valor: string) => fireEvent.change(screen.getByLabelText(rotulo), { target: { value: valor } });
const salvar = () => screen.getByRole('button', { name: 'Salvar fase' }) as HTMLButtonElement;

test('o admin da liga lista Copa do Brasil e a lista de fases cria uma nova (ORDEM_REPETIDA avisa)', async () => {
  const chamadas = fetchFalso({
    'GET /copa': [{ fase: fase({ prazoPalpite: '2099-11-26T21:00:00Z' }), jogos: [] }, { fase: fase({ id: 'f0', nome: 'Pré', ordem: 0, fechada: true, resumoPublicado: true }), jogos: [] }],
    'POST /admin/copa/fases': { status: 409, corpo: { codigo: 'ORDEM_REPETIDA', mensagem: 'x' } },
  });
  tela('/admin/copa');
  expect(await screen.findByText('Oitavas')).toBeTruthy();
  expect(screen.getByText('Fechada · resumo publicado')).toBeTruthy();
  const criar = screen.getByRole('button', { name: 'Criar fase' }) as HTMLButtonElement;
  expect(criar.disabled).toBe(true);
  fireEvent.change(screen.getByLabelText('Nome da fase'), { target: { value: 'Quartas' } });
  fireEvent.change(screen.getByLabelText('Ordem'), { target: { value: '1' } });
  fireEvent.click(criar);
  expect(await screen.findByText('Já existe uma fase com essa ordem. Escolha outro número.')).toBeTruthy();
  expect(JSON.parse(chamadas.find((x) => x.chave === 'POST /admin/copa/fases')!.body as string)).toEqual({ nome: 'Quartas', ordem: 1 });
});

test('confrontos: a CBF não aparece, clube só uma vez por fase, empate pede pênaltis que não empatam, gols vazios = agendado', async () => {
  const chamadas = fetchFalso({ 'GET /copa': [{ fase: fase(), jogos: [] }], 'GET /clubes': clubes, 'PUT /admin/copa/fases/f1/jogos': { status: 204 }, 'PUT /admin/copa/fases/f1/prazo': { status: 204 } });
  tela('/admin/copa/f1');
  fireEvent.click(await screen.findByRole('button', { name: 'Adicionar confronto' }));
  fireEvent.click(screen.getByRole('button', { name: 'Adicionar confronto' }));
  expect(within(screen.getByLabelText('Mandante do confronto 1')).queryByRole('option', { name: /CBF/ })).toBeNull();
  muda('Mandante do confronto 1', 'santos'); muda('Visitante do confronto 1', 'vasco');
  expect((within(screen.getByLabelText('Mandante do confronto 2')).getByRole('option', { name: /Santos/ }) as HTMLOptionElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Remover confronto 2' }));
  expect(salvar().disabled).toBe(false); // agendado, sem gols
  muda('Gols do mandante, confronto 1', '1'); muda('Gols do visitante, confronto 1', '1');
  expect(screen.getByText('Quem passa não pode empatar.')).toBeTruthy();
  expect(salvar().disabled).toBe(true); // empate sem pênaltis
  muda('Pênaltis do mandante, confronto 1', '4'); muda('Pênaltis do visitante, confronto 1', '4');
  expect(salvar().disabled).toBe(true); // pênaltis empatados
  muda('Pênaltis do visitante, confronto 1', '5');
  expect(salvar().disabled).toBe(false);
  muda('Prazo de palpite', '2099-11-26T21:00');
  fireEvent.click(salvar());
  await waitFor(() => expect(chamadas.some((x) => x.chave === 'PUT /admin/copa/fases/f1/prazo')).toBe(true));
  expect(JSON.parse(chamadas.find((x) => x.chave === 'PUT /admin/copa/fases/f1/jogos')!.body as string)).toEqual({ jogos: [{ mandanteId: 'santos', visitanteId: 'vasco', golsMandante: 1, golsVisitante: 1, penaltisMandante: 4, penaltisVisitante: 5 }] });
  expect(JSON.parse(chamadas.find((x) => x.chave === 'PUT /admin/copa/fases/f1/prazo')!.body as string).prazoPalpite).toMatch(/^2099-11-2[67]T/);
});

test('CLUBE_ELIMINADO mostra quem perdeu e onde, com borda no confronto', async () => {
  const oitavas = { fase: fase({ fechada: true, resumoPublicado: true }), jogos: [{ id: 'cj0', mandante: clubes[0], visitante: clubes[1], golsMandante: 0, golsVisitante: 2, penaltisMandante: null, penaltisVisitante: null, vencedor: clubes[1] }] };
  const quartas = { fase: fase({ id: 'f2', nome: 'Quartas', ordem: 2 }), jogos: [{ id: 'cj1', mandante: clubes[0], visitante: clubes[2], ...vazio }] };
  fetchFalso({ 'GET /copa': [oitavas, quartas], 'GET /clubes': clubes, 'PUT /admin/copa/fases/f2/jogos': { status: 409, corpo: { codigo: 'CLUBE_ELIMINADO', mensagem: 'x' } } });
  tela('/admin/copa/f2');
  fireEvent.click(await screen.findByRole('button', { name: 'Salvar fase' }));
  expect(await screen.findByText('Santos perdeu em Oitavas e não pode jogar Quartas.')).toBeTruthy();
  expect(document.querySelector('.cartao-jogo.pendente')).not.toBeNull();
});

test('fechar exige todos os placares; fechado abre a folha (portal no body) com a prévia, e publicar manda o texto editado', async () => {
  const chamadas = fetchFalso({
    'GET /copa': [{ fase: fase(), jogos: [{ id: 'cj1', mandante: clubes[0], visitante: clubes[1], golsMandante: 2, golsVisitante: 0, penaltisMandante: null, penaltisVisitante: null, vencedor: clubes[0] }, { id: 'cj2', mandante: clubes[2], visitante: clubes[0], ...vazio }] }],
    'GET /clubes': clubes,
  });
  tela('/admin/copa/f1');
  fireEvent.click(await screen.findByRole('button', { name: 'Fechar fase' }));
  expect(await screen.findByText('Preencha todos os placares (e os pênaltis nos empates) para fechar a fase.')).toBeTruthy();
  expect(chamadas.some((x) => x.chave.includes('fechar'))).toBe(false);
  cleanup();

  const ok = fetchFalso({
    'GET /copa': [{ fase: fase(), jogos: [{ id: 'cj1', mandante: clubes[0], visitante: clubes[1], golsMandante: 2, golsVisitante: 0, penaltisMandante: null, penaltisVisitante: null, vencedor: clubes[0] }] }],
    'GET /clubes': clubes,
    'PUT /admin/copa/fases/f1/jogos': { status: 204 },
    'POST /admin/copa/fases/f1/fechar': { status: 201, corpo: { texto: 'Santos passou!', citados: ['tvasco'] } },
    'POST /admin/copa/fases/f1/publicar': { status: 409, corpo: { codigo: 'RESUMO_JA_PUBLICADO', mensagem: 'x' } },
  });
  tela('/admin/copa/f1');
  fireEvent.click(await screen.findByRole('button', { name: 'Fechar fase' }));
  const folha = await screen.findByRole('dialog', { name: 'Resumo da CBF' });
  expect(folha.closest('.veu')?.parentElement).toBe(document.body); // portal
  expect(screen.getByText(/só pode ser publicado uma vez por fase/)).toBeTruthy();
  const texto = screen.getByLabelText('Texto do resumo') as HTMLTextAreaElement;
  expect(texto.value).toBe('Santos passou!');
  fireEvent.change(texto, { target: { value: 'Texto do admin' } });
  fireEvent.click(screen.getByRole('button', { name: 'Publicar como CBF' }));
  await waitFor(() => expect(location.pathname).toBe('/admin/copa')); // 409 RESUMO_JA_PUBLICADO conta como feito
  expect(JSON.parse(ok.find((x) => x.chave === 'POST /admin/copa/fases/f1/publicar')!.body as string)).toEqual({ texto: 'Texto do admin', citados: ['tvasco'] });
});

test('fase fechada: placares travados, aviso verde e Reabrir fase com a nota do recálculo', async () => {
  let fechada = true;
  const chamadas = fetchFalso({
    'GET /copa': () => [{ fase: fase({ fechada, resumoPublicado: true }), jogos: [{ id: 'cj1', mandante: clubes[0], visitante: clubes[1], golsMandante: 1, golsVisitante: 1, penaltisMandante: 4, penaltisVisitante: 5, vencedor: clubes[1] }] }],
    'GET /clubes': clubes,
    'POST /admin/copa/fases/f1/reabrir': () => { fechada = false; return { status: 204 }; },
  });
  tela('/admin/copa/f1');
  expect(await screen.findByText(/Fase fechada. Resumo publicado pela CBF/)).toBeTruthy();
  expect(screen.getByText(/Santos 1 × 1 Vasco \(pênaltis 4 × 5\)/)).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Salvar fase' })).toBeNull();
  expect(screen.getByText('Reabrir deixa mudar placares. Se mudar, os pontos do bolão são recalculados.')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Reabrir fase' }));
  await screen.findByRole('button', { name: 'Salvar fase' });
  expect(chamadas.some((x) => x.chave === 'POST /admin/copa/fases/f1/reabrir')).toBe(true);
});

test('fase fechada sem resumo: "Publicar resumo" pede a prévia de novo (POST /previa) e publica', async () => {
  const chamadas = fetchFalso({
    'GET /copa': [{ fase: fase({ fechada: true, resumoPublicado: false }), jogos: [{ id: 'cj1', mandante: clubes[0], visitante: clubes[1], golsMandante: 2, golsVisitante: 0, penaltisMandante: null, penaltisVisitante: null, vencedor: clubes[0] }] }],
    'GET /clubes': clubes,
    'POST /admin/copa/fases/f1/previa': { status: 201, corpo: { texto: 'Outra frase', citados: ['tvasco'] } },
    'POST /admin/copa/fases/f1/publicar': { status: 201, corpo: {} },
  });
  tela('/admin/copa/f1');
  expect(await screen.findByText('Fase fechada. O resumo da CBF ainda não foi publicado.')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Publicar resumo' }));
  const campo = await screen.findByLabelText('Texto do resumo') as HTMLTextAreaElement;
  expect(campo.value).toBe('Outra frase');
  fireEvent.click(screen.getByRole('button', { name: 'Publicar como CBF' }));
  await waitFor(() => expect(location.pathname).toBe('/admin/copa'));
  expect(JSON.parse(chamadas.find((x) => x.chave === 'POST /admin/copa/fases/f1/publicar')!.body as string)).toEqual({ texto: 'Outra frase', citados: ['tvasco'] });
});
