import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type { Me } from '../api/cliente';
import { fetchFalso } from '../testes/fetchFalso';
import { Liga } from './Liga';
import { montarAlvos } from './Bolao';
import { PalpitesDoJogo } from './PalpitesDoJogo';

const me: Me = { id: 'u1', nome: 'Lincoln', email: 'l@x.com', avatarUrl: null, isAdmin: false, pushEnabled: false, clube: null };
const c = (id: string) => ({ id, nome: id[0].toUpperCase() + id.slice(1), escudoUrl: `/escudos/${id}.svg` });
const amanha = () => new Date(Date.now() + 86400_000).toISOString();
const rodada = (prazoPalpite: string | null) => [{ numero: 13, fechada: false, prazoPalpite, jogos: [{ id: 'j1', mandante: c('santos'), visitante: c('vasco'), golsMandante: null, golsVisitante: null }, { id: 'j2', mandante: c('bahia'), visitante: c('remo'), golsMandante: null, golsVisitante: null }] }];
const copa = (prazoPalpite: string | null) => [{ fase: { id: 'f1', nome: 'Quartas', ordem: 2, prazoPalpite, fechada: false }, jogos: [{ id: 'cj1', mandante: c('santos'), visitante: c('vasco'), golsMandante: null, golsVisitante: null, penaltisMandante: null, penaltisVisitante: null, vencedor: null }] }];
const base = (prazo: string | null, extra = {}) => ({ 'GET /liga/tabela': [], 'GET /liga/rodadas': rodada(prazo), 'GET /copa': copa(prazo), 'GET /bolao/meus?rodada=13': [], 'GET /bolao/meus?fase=f1': [], ...extra });

beforeEach(() => history.replaceState(null, '', '/liga?aba=bolao'));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers(); });
// os cartões só aparecem depois do GET /bolao/meus (até lá é esqueleto)
const cartoes = () => screen.findByRole('listitem', { name: 'Santos contra Vasco' });
const clica = (nome: string | RegExp) => fireEvent.click(screen.getByRole('button', { name: nome }));
const mais = (clube: string, vezes = 1) => { for (let i = 0; i < vezes; i++) clica(`Mais um gol para o ${clube}`); };

test('chips: prazo futuro mais próximo primeiro, sem prazo depois, travados por último', () => {
  const agora = Date.now();
  const r = (n: number, p: string | null) => ({ numero: n, fechada: false, prazoPalpite: p, jogos: [{ id: 'j' + n, mandante: c('santos'), visitante: c('vasco'), golsMandante: null, golsVisitante: null }] });
  const alvos = montarAlvos([r(1, new Date(agora - 3600_000).toISOString()), r(2, null), r(3, new Date(agora + 7200_000).toISOString()), r(4, new Date(agora + 3600_000).toISOString())], []);
  expect(alvos.map((a) => a.rotulo)).toEqual(['Rodada 4', 'Rodada 3', 'Rodada 2', 'Rodada 1']);
});

test('palpitar: stepper 0–99, faixa de prazo correndo, Salvar só habilita com algo mudado e manda o lote', async () => {
  const chamadas = fetchFalso(base(amanha(), { 'PUT /bolao/palpites': { status: 204 } }));
  render(<Liga me={me} />);
  expect(await screen.findByText(/Palpite até/)).toBeTruthy();
  await cartoes();
  expect(screen.getByText(/Faltam? \d+ h|Falta 1 dia/)).toBeTruthy();
  const salvar = screen.getByRole('button', { name: 'Salvar palpites' }) as HTMLButtonElement;
  expect(salvar.disabled).toBe(true);
  expect((screen.getByRole('button', { name: 'Menos um gol para o Santos' }) as HTMLButtonElement).disabled).toBe(true); // vazio/0 não desce
  mais('Santos', 2); mais('Vasco', 1);
  expect(screen.getByRole('spinbutton', { name: 'Gols do Santos, 1' }).getAttribute('aria-valuemax')).toBe('99');
  mais('Santos'); // 2
  expect(salvar.disabled).toBe(false);
  clica('Salvar palpites');
  await screen.findByText('Palpites salvos.');
  const corpo = JSON.parse(chamadas.find((x) => x.chave === 'PUT /bolao/palpites')!.body as string);
  expect(corpo).toEqual([{ jogoId: 'j1', golsMandante: 2, golsVisitante: 0 }]);
});

test('meio-palpite (só um lado) não salva', async () => {
  fetchFalso(base(amanha()));
  render(<Liga me={me} />);
  await screen.findByText(/Palpite até/);
  await cartoes();
  mais('Santos');
  expect((screen.getByRole('button', { name: 'Salvar palpites' }) as HTMLButtonElement).disabled).toBe(true);
});

test('Copa: palpite de empate exige quem passa; Salvar fica inerte até escolher e a escolha vai em classificadoId', async () => {
  const chamadas = fetchFalso(base(amanha(), { 'PUT /bolao/palpites': { status: 204 } }));
  render(<Liga me={me} />);
  await screen.findByText(/Palpite até/);
  await cartoes();
  clica('Copa · Quartas');
  await screen.findByRole('listitem', { name: 'Santos contra Vasco' });
  mais('Santos'); mais('Vasco'); // 0 × 0
  const salvar = screen.getByRole('button', { name: 'Salvar palpites' }) as HTMLButtonElement;
  expect(salvar.disabled).toBe(true);
  expect(screen.getByText('Empate no palpite: escolha quem passa. Acertar quem passa vale +1.')).toBeTruthy();
  const grupo = screen.getByRole('group', { name: 'Quem passa nos pênaltis' });
  fireEvent.click(within(grupo).getByRole('button', { name: /VAS/ }));
  expect(salvar.disabled).toBe(false);
  mais('Santos'); // vira 1 × 0: sem empate, a escolha some
  expect(screen.queryByRole('group', { name: 'Quem passa nos pênaltis' })).toBeNull();
  mais('Vasco'); // 1 × 1 de novo: escolha zerada
  expect(salvar.disabled).toBe(true);
  fireEvent.click(within(screen.getByRole('group', { name: 'Quem passa nos pênaltis' })).getByRole('button', { name: /SAN/ }));
  clica('Salvar palpites');
  await screen.findByText('Palpites salvos.');
  expect(JSON.parse(chamadas.find((x) => x.chave === 'PUT /bolao/palpites')!.body as string)).toEqual([{ copaJogoId: 'cj1', golsMandante: 1, golsVisitante: 1, classificadoId: 'santos' }]);
});

test('409 PRAZO_ENCERRADO com a tela aberta: faixa de erro, campos travados e nada salvo', async () => {
  fetchFalso(base(amanha(), { 'PUT /bolao/palpites': { status: 409, corpo: { codigo: 'PRAZO_ENCERRADO', mensagem: 'x' } } }));
  render(<Liga me={me} />);
  await screen.findByText(/Palpite até/);
  await cartoes();
  mais('Santos'); mais('Vasco');
  clica('Salvar palpites');
  expect(await screen.findByText('O prazo acabou. Nenhum palpite foi salvo.')).toBeTruthy();
  expect(screen.queryByRole('button', { name: /Mais um gol/ })).toBeNull(); // sem stepper
  expect(screen.getByRole('button', { name: 'Ver palpites dos outros' })).toBeTruthy();
});

test('prazo que passa com a tela aberta trava sozinho (timer de 30 s)', async () => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
  const prazo = new Date(Date.now() + 40_000).toISOString();
  fetchFalso(base(prazo));
  render(<Liga me={me} />);
  await vi.waitFor(() => expect(screen.queryByText(/Palpite até/)).not.toBeNull());
  await act(async () => { vi.advanceTimersByTime(60_000); });
  expect(screen.getByText(/Prazo encerrado em/)).toBeTruthy();
  expect(screen.queryByRole('button', { name: /Mais um gol/ })).toBeNull();
});

test('sem prazo: campos travados e faixa explica', async () => {
  fetchFalso(base(null));
  render(<Liga me={me} />);
  expect(await screen.findByText('O admin ainda não definiu o prazo. Dá para palpitar quando ele definir.')).toBeTruthy();
  expect(screen.queryByRole('button', { name: /Mais um gol/ })).toBeNull();
});

test('chega por ?rodada=13 já na rodada pedida e mostra palpites salvos com pontos depois do prazo', async () => {
  history.replaceState(null, '', '/liga?aba=bolao&rodada=13');
  const passado = new Date(Date.now() - 3600_000).toISOString();
  fetchFalso(base(passado, { 'GET /bolao/meus?rodada=13': [{ jogoId: 'j1', copaJogoId: null, golsMandante: 2, golsVisitante: 1, classificadoId: null, pontos: 3, exato: true }] }));
  render(<Liga me={me} />);
  expect(await screen.findByText(/Prazo encerrado em/)).toBeTruthy();
  expect(await screen.findByLabelText('3 pontos')).toBeTruthy();
  expect(screen.getAllByRole('link', { name: 'Palpites dos outros' })[0].getAttribute('href')).toBe('/bolao/jogo/brasileirao/j1');
});

const ator = (id: string, nome: string) => ({ id, nome, avatarUrl: null });
test('palpites dos outros ANTES do prazo: só o meu e o aviso com cadeado (nada de lista alheia)', async () => {
  const prazo = amanha();
  fetchFalso({
    'GET /bolao/jogo/brasileirao/j1': [{ usuario: ator('u1', 'Lincoln'), golsMandante: 1, golsVisitante: 0, classificadoId: null, pontos: null, exato: false }],
    'GET /liga/rodadas': rodada(prazo),
  });
  render(<PalpitesDoJogo tipo="brasileirao" id="j1" />);
  expect(await screen.findByText(/Os palpites dos outros aparecem depois do prazo/)).toBeTruthy();
  expect(screen.getByRole('heading', { name: 'Seu palpite' })).toBeTruthy();
  expect(screen.getAllByRole('listitem')).toHaveLength(1);
});

test('palpites dos outros DEPOIS do prazo: ordem por pontos e nome, chip de pontos e "passa:" na Copa', async () => {
  const passado = new Date(Date.now() - 3600_000).toISOString();
  const fases = copa(passado);
  fases[0].jogos[0] = { ...fases[0].jogos[0], golsMandante: 1, golsVisitante: 1, penaltisMandante: 3, penaltisVisitante: 4, vencedor: c('vasco') } as never;
  fetchFalso({
    'GET /bolao/jogo/copa/cj1': [
      { usuario: ator('u2', 'Zeca'), golsMandante: 2, golsVisitante: 0, classificadoId: null, pontos: 0, exato: false },
      { usuario: ator('u3', 'Ana'), golsMandante: 1, golsVisitante: 1, classificadoId: 'vasco', pontos: 4, exato: true },
      { usuario: ator('u1', 'Lincoln'), golsMandante: 0, golsVisitante: 0, classificadoId: 'vasco', pontos: 2, exato: false },
    ],
    'GET /copa': fases,
  });
  render(<PalpitesDoJogo tipo="copa" id="cj1" />);
  await screen.findByText('Palpite de cada um', { selector: 'h2' });
  const itens = screen.getAllByRole('listitem');
  expect(itens.map((i) => i.querySelector('strong')!.textContent)).toEqual(['Ana', 'Lincoln', 'Zeca']);
  expect(within(itens[0]).getByText('passa: Vasco')).toBeTruthy();
  expect(within(itens[0]).getByLabelText('4 pontos')).toBeTruthy();
  expect(document.querySelector('.resultado strong')!.textContent).toBe('1 × 1');
});

test('ranking: posições, exatos, minha linha marcada; vazio explica', async () => {
  fetchFalso({
    ...base(amanha()),
    'GET /bolao/ranking': [
      { usuario: ator('u2', 'Ana'), pontos: 9, exatos: 2, posicao: 1 },
      { usuario: ator('u1', 'Lincoln'), pontos: 9, exatos: 1, posicao: 2 },
    ],
  });
  render(<Liga me={me} />);
  await screen.findByText(/Palpite até/);
  fireEvent.click(screen.getByRole('tab', { name: 'Ranking' }));
  const itens = await screen.findAllByRole('listitem');
  expect(itens.map((i) => i.textContent)).toEqual(['1ºAAna92 exatos', '2ºLLincoln91 exato']);
  expect(itens[1].getAttribute('aria-current')).toBe('true');
  cleanup();
  fetchFalso({ ...base(amanha()), 'GET /bolao/ranking': [] });
  render(<Liga me={me} />);
  await screen.findByText(/Palpite até/);
  fireEvent.click(screen.getByRole('tab', { name: 'Ranking' }));
  expect(await screen.findByText('Ninguém pontuou ainda')).toBeTruthy();
});

test('até o GET /bolao/meus responder só há esqueleto (nada para digitar); depois vale o palpite salvo', async () => {
  fetchFalso(base(amanha(), { 'GET /bolao/meus?rodada=13': [{ jogoId: 'j1', copaJogoId: null, golsMandante: 5, golsVisitante: 4, classificadoId: null, pontos: null, exato: false }] }));
  const original = fetch;
  let abre!: () => void;
  const porta = new Promise<void>((r) => { abre = r; });
  vi.stubGlobal('fetch', (u: string, i?: RequestInit) => (String(u).includes('/bolao/meus') ? porta.then(() => original(u, i)) : original(u, i)));
  render(<Liga me={me} />);
  await screen.findByText(/Palpite até/);
  expect(screen.queryByRole('button', { name: /Mais um gol/ })).toBeNull();
  expect(document.querySelector('[aria-busy="true"]')).not.toBeNull();
  abre();
  expect(await screen.findByRole('spinbutton', { name: 'Gols do Santos, 5' })).toBeTruthy();
});

test('trocar de chip com o GET do anterior ainda no ar: a resposta velha é ignorada', async () => {
  fetchFalso(base(amanha(), {
    'GET /bolao/meus?rodada=13': [{ jogoId: 'j1', copaJogoId: null, golsMandante: 7, golsVisitante: 7, classificadoId: null, pontos: null, exato: false }],
    'GET /bolao/meus?fase=f1': [{ jogoId: null, copaJogoId: 'cj1', golsMandante: 2, golsVisitante: 0, classificadoId: null, pontos: null, exato: false }],
  }));
  const original = fetch;
  let abre!: () => void;
  const porta = new Promise<void>((r) => { abre = r; });
  vi.stubGlobal('fetch', (u: string, i?: RequestInit) => (String(u).includes('rodada=13') ? porta.then(() => original(u, i)) : original(u, i)));
  render(<Liga me={me} />);
  await screen.findByText(/Palpite até/);
  clica('Copa · Quartas'); // a rodada 13 ainda não respondeu
  expect(await screen.findByRole('spinbutton', { name: 'Gols do Santos, 2' })).toBeTruthy();
  abre();
  await act(async () => { await porta; });
  expect(screen.getByRole('spinbutton', { name: 'Gols do Santos, 2' })).toBeTruthy(); // não virou 7
  expect(screen.queryByRole('spinbutton', { name: 'Gols do Santos, 7' })).toBeNull();
});

// IM-81: fechadas continuam visíveis
const placar = (n: number, gm: number | null, gv: number | null) => ({ id: 'j' + n, mandante: c('santos'), visitante: c('vasco'), golsMandante: gm, golsVisitante: gv });
const fech = (numero: number, prazoPalpite: string | null, jogos: ReturnType<typeof placar>[]) => ({ numero, fechada: true, prazoPalpite, jogos });
const passado = () => new Date(Date.now() - 86400_000).toISOString();

test('chips: abertas como antes, depois as fechadas da mais recente à mais antiga; fase fechada entra por ordem', () => {
  const j = [placar(1, 1, 0)];
  const fase = (id: string, ordem: number) => ({ fase: { id, nome: 'F' + id, ordem, prazoPalpite: passado(), fechada: true }, jogos: [{ ...j[0], penaltisMandante: null, penaltisVisitante: null, vencedor: null }] });
  const alvos = montarAlvos([fech(2, null, j), { numero: 9, fechada: false, prazoPalpite: amanha(), jogos: j }, fech(5, passado(), j), fech(3, passado(), j)], [fase('a', 1), fase('b', 3)] as never);
  expect(alvos.map((a) => a.rotulo)).toEqual(['Rodada 9', 'Rodada 5', 'Rodada 3', 'Rodada 2', 'Copa · Fb', 'Copa · Fa']);
});

test('sem escolha na URL abre na próxima aberta; fechada mostra placar, meu palpite, pontos e "Você não palpitou"', async () => {
  fetchFalso({
    'GET /liga/tabela': [],
    'GET /liga/rodadas': [fech(12, passado(), [placar(1, 2, 1), placar(2, 0, 0), placar(3, 1, 1)]), ...rodada(amanha())],
    'GET /copa': [],
    'GET /bolao/meus?rodada=13': [],
    'GET /bolao/meus?rodada=12': [
      { jogoId: 'j1', copaJogoId: null, golsMandante: 2, golsVisitante: 1, classificadoId: null, pontos: 3, exato: true },
      { jogoId: 'j2', copaJogoId: null, golsMandante: 1, golsVisitante: 0, classificadoId: null, pontos: 0, exato: false },
    ],
  });
  render(<Liga me={me} />);
  expect(await screen.findByText(/Palpite até/)).toBeTruthy();
  const chips = within(screen.getByRole('group', { name: 'Rodada ou fase' })).getAllByRole('button');
  expect(chips.map((b) => b.textContent)).toEqual(['Rodada 13', 'Rodada 12']);
  expect(chips[0].getAttribute('aria-pressed')).toBe('true');
  clica('Rodada 12');
  expect(await screen.findByText('Rodada encerrada')).toBeTruthy();
  const cards = await screen.findAllByRole('listitem', { name: 'Santos contra Vasco' });
  expect(within(cards[0]).getByText('Placar 2 × 1')).toBeTruthy();
  expect(within(cards[0]).getByLabelText('3 pontos').textContent).toBe('+3');
  expect(within(cards[1]).getByLabelText('0 pontos').textContent).toBe('0');
  expect(within(cards[2]).getByText('Você não palpitou')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Salvar palpites' })).toBeNull();
  expect(screen.queryByRole('button', { name: /Mais um gol/ })).toBeNull();
  expect(screen.getAllByRole('link', { name: 'Palpites dos outros' })).toHaveLength(3);
});

test('rodada fechada sem prazo: "Sem bolão nesta rodada", sem link e sem botão', async () => {
  fetchFalso({ 'GET /liga/tabela': [], 'GET /liga/rodadas': [fech(1, null, [placar(1, 2, 1)])], 'GET /copa': [], 'GET /bolao/meus?rodada=1': [] });
  render(<Liga me={me} />);
  expect(await screen.findByText('Sem bolão nesta rodada')).toBeTruthy();
  await cartoes();
  expect(screen.queryByRole('link', { name: 'Palpites dos outros' })).toBeNull();
  expect(screen.queryByRole('button', { name: /palpites dos outros/i })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Salvar palpites' })).toBeNull();
  expect(screen.queryByText('Você não palpitou')).toBeNull();
});

test('GET /bolao/meus falha (500) numa rodada fechada: não diz "Você não palpitou" e mantém o aviso', async () => {
  fetchFalso({ 'GET /liga/tabela': [], 'GET /liga/rodadas': [fech(12, passado(), [placar(1, 2, 1)])], 'GET /copa': [], 'GET /bolao/meus?rodada=12': { status: 500 } });
  render(<Liga me={me} />);
  expect(await screen.findByText('Não deu para carregar seus palpites. Tente de novo.')).toBeTruthy();
  expect(await screen.findByText('Placar 2 × 1')).toBeTruthy();
  expect(screen.queryByText('Você não palpitou')).toBeNull();
});

test('Copa fechada: placar 1×1, pênaltis 4 a 5, quem passou e pontos; faixa diz "Fase encerrada"', async () => {
  const jogo = { id: 'cj1', mandante: c('santos'), visitante: c('vasco'), golsMandante: 1, golsVisitante: 1, penaltisMandante: 4, penaltisVisitante: 5, vencedor: c('vasco') };
  fetchFalso({
    'GET /liga/tabela': [], 'GET /liga/rodadas': [], 'GET /copa': [{ fase: { id: 'f1', nome: 'Quartas', ordem: 2, prazoPalpite: passado(), fechada: true }, jogos: [jogo] }],
    'GET /bolao/meus?fase=f1': [{ jogoId: null, copaJogoId: 'cj1', golsMandante: 1, golsVisitante: 1, classificadoId: 'vasco', pontos: 4, exato: true }],
  });
  render(<Liga me={me} />);
  expect(await screen.findByText('Fase encerrada')).toBeTruthy();
  expect(await screen.findByText('Placar 1 × 1 (pênaltis 4 a 5)')).toBeTruthy();
  expect(screen.getByText('Vasco passou nos pênaltis')).toBeTruthy();
  expect(screen.getByLabelText('4 pontos').textContent).toBe('+4');
});
