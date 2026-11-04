import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { App } from './App';
import { fetchFalso } from './testes/fetchFalso';

const clube = { id: 'palmeiras', nome: 'Palmeiras', escudoUrl: '/escudos/palmeiras.svg' };
const me = { id: 'a1', nome: 'Fabio', email: 'f@x.com', avatarUrl: null, isAdmin: true, pushEnabled: false, clube };
const jogo = { id: 'j1', mandante: clube, visitante: { ...clube, id: 'flamengo', nome: 'Flamengo' }, golsMandante: 1, golsVisitante: 0 };
const votacao = { id: 'v1', titulo: 'Clube do mês', tipo: 'CLUBE', prazo: new Date(Date.now() + 86400_000).toISOString(), aberta: true, encerrada: false, opcoes: [{ id: 'flamengo', rotulo: 'Flamengo' }], meuVoto: null };
const post = { id: 'p1', clube, autor: { id: 'a1', nome: 'Fabio' }, legenda: 'x', imagens: [], curtidas: 0, curtiu: false, comentarios: 0, podeEditar: true, criadoEm: new Date().toISOString() };

beforeEach(() => {
  localStorage.setItem('im:instalar-visto', '1');
  vi.stubGlobal('IntersectionObserver', class { observe() {} disconnect() {} unobserve() {} });
});
afterEach(() => { cleanup(); localStorage.clear(); vi.unstubAllGlobals(); });

// rota → o que o fetch precisa responder; `abrir` leva até a tela que tem a barra fixa
const ROTAS: { caminho: string; api: Record<string, unknown>; abrir?: () => Promise<unknown>; edicao?: boolean }[] = [
  { caminho: '/admin/rodadas/1', api: { 'GET /liga/rodadas': [{ numero: 1, fechada: false, jogos: [jogo] }], 'GET /clubes': [clube] } },
  {
    caminho: '/admin/rodadas/1', // prévia do bot
    api: { 'GET /liga/rodadas': [{ numero: 1, fechada: true, jogos: [jogo] }], 'GET /clubes': [clube], 'POST /admin/rodadas/1/previa': { status: 201, corpo: { texto: 'Resumo', citados: [] } } },
    abrir: async () => fireEvent.click(await screen.findByRole('button', { name: 'Publicar resumo' })),
  },
  { caminho: '/admin/votacoes/nova', api: { 'GET /clubes': [clube] } },
  { caminho: '/votacoes/v1', api: { 'GET /votacoes/v1': votacao } },
  { caminho: '/postar', api: {}, edicao: true },
  { caminho: '/p/p1/editar', api: { 'GET /posts/p1': post }, edicao: true },
];

test.each(ROTAS)('barra de ação fixa de $caminho usa .acao-fixa dentro do <main> (sobe a altura da barra inferior)', async ({ caminho, api, abrir, edicao }) => {
  fetchFalso({ 'GET /me': me, ...api });
  history.pushState(null, '', caminho);
  render(<App />);
  await (abrir ? abrir() : screen.findByRole('main').catch(() => null));
  await vi.waitFor(() => expect(document.querySelector('main .acao-fixa')).not.toBeNull());
  expect(document.querySelector('main')!.classList.contains('tela-cheia')).toBe(!!edicao);
  expect(document.querySelector('.acao-fixa')!.getAttribute('style')).toBeNull(); // posição só pelo CSS compartilhado
});

test('CSS: um token --altura-barra e uma regra única para .acao-fixa (0 nas telas de edição e no desktop)', () => {
  const tokens = readFileSync('src/tokens.css', 'utf8');
  const conta = readFileSync('src/conta/conta.css', 'utf8');
  expect(tokens).toMatch(/:root \{ --altura-barra: 64px; \}/);
  expect(tokens).toMatch(/main\.tela-cheia \{ --altura-barra: 0px; \}/);
  expect(tokens).toMatch(/min-width: 768px\) \{ :root \{ --altura-barra: 0px; \}/);
  expect(conta).toMatch(/main \.acao-fixa \{ bottom: calc\(var\(--altura-barra\) \+ var\(--im-e4\) \+ env\(safe-area-inset-bottom\)\); \}/);
  // nenhuma tela define posição própria para a barra fixa
  for (const css of ['src/admin/admin.css', 'src/votacoes/votacoes.css', 'src/postar/postar.css', 'src/clube/clube.css']) expect(readFileSync(css, 'utf8')).not.toMatch(/\.acao-fixa\s*\{[^}]*bottom/);
});

test('rota inválida (/clubes/x) mostra "Não achamos essa página" com Voltar', async () => {
  fetchFalso({ 'GET /me': me });
  history.pushState(null, '', '/clubes/x');
  render(<App />);
  expect(await screen.findByText('Não achamos essa página')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Voltar' }));
  expect(location.pathname).toBe('/');
});
