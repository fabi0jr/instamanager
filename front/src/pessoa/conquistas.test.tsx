import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { readdirSync, readFileSync } from 'node:fs';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { Atividade } from '../atividade/Atividade';
import { Perfil } from '../conta/Perfil';
import { fetchFalso } from '../testes/fetchFalso';
import { PerfilPessoa } from './PerfilPessoa';

const clube = { id: 'santos', nome: 'Santos', escudoUrl: '/escudos/santos.svg' };
const nivel = (xp: number, nome: string, min: number, proximo: number | null) => ({ xp, nome, min, proximo });
const pessoa = (extra = {}) => ({ id: 'u9', nome: 'Marcos Silva', avatarUrl: null, clube, historico: [], posts: { itens: [], proximo: null }, nivel: nivel(101, 'Auxiliar', 100, 300), conquistas: [], ...extra });
const barra = () => screen.getByRole('progressbar');

beforeEach(() => vi.stubGlobal('IntersectionObserver', class { observe() {} disconnect() {} unobserve() {} }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

test('selo de nível: nome, XP, barra a (xp−min)/(próximo−min) e quanto falta', async () => {
  fetchFalso({ 'GET /pessoas/u9': pessoa({ nivel: nivel(412, 'Técnico', 300, 700) }) });
  render(<PerfilPessoa id="u9" />);
  await screen.findByRole('progressbar');
  expect(barra().getAttribute('aria-label')).toBe('Técnico, 412 de 700 XP');
  expect(barra().getAttribute('aria-valuenow')).toBe('112'); // XP dentro do nível
  expect(barra().getAttribute('aria-valuemax')).toBe('400');
  expect((barra().firstElementChild as HTMLElement).style.width).toBe('28%');
  expect(screen.getByText('412 XP')).toBeTruthy();
  expect(screen.getByText('Faltam 288 XP para Professor')).toBeTruthy();
});

test('barra de XP "101 / 300 XP" do Auxiliar, e o novato com a barra vazia', async () => {
  fetchFalso({ 'GET /pessoas/u9': pessoa() });
  render(<PerfilPessoa id="u9" />);
  await screen.findByRole('progressbar');
  expect(barra().getAttribute('aria-label')).toBe('Auxiliar, 101 de 300 XP');
  expect(screen.getByText('Faltam 199 XP para Técnico')).toBeTruthy();
  cleanup();
  fetchFalso({ 'GET /pessoas/u9': pessoa({ nivel: nivel(0, 'Estagiário', 0, 100) }) });
  render(<PerfilPessoa id="u9" />);
  await screen.findByText('Faltam 100 XP para Auxiliar');
  expect((barra().firstElementChild as HTMLElement).style.width).toBe('0%');
});

test('Lenda não tem "próximo": barra cheia e "Nível máximo"', async () => {
  fetchFalso({ 'GET /pessoas/u9': pessoa({ nivel: nivel(1600, 'Lenda', 1500, null) }) });
  render(<PerfilPessoa id="u9" />);
  expect(await screen.findByText('Nível máximo')).toBeTruthy();
  expect(screen.queryByText(/Faltam/)).toBeNull();
  expect((barra().firstElementChild as HTMLElement).style.width).toBe('100%');
});

test('grade: 8 em ordem fixa, a que falta com aria-disabled e a regra, a conquistada com a data', async () => {
  fetchFalso({ 'GET /pessoas/u9': pessoa({ conquistas: [{ tipo: 'GOLEADA', nome: 'Goleada', vezes: 1, ultimaEm: '2026-11-03T15:00:00Z' }] }) });
  render(<PerfilPessoa id="u9" />);
  expect(await screen.findByText('Conquistas · 1 de 8')).toBeTruthy();
  const itens = [...document.querySelectorAll('.conquistas li')];
  expect(itens.map((l) => l.querySelector('.conq-nome')!.textContent)).toEqual(['Primeira vitória', 'Goleada', 'Invicto', 'Líder', 'Campeão da Copa', 'Rei do bolão', 'Primeiro story', 'Comunicador']);
  const goleada = itens[1];
  expect(goleada.getAttribute('aria-disabled')).toBeNull();
  expect(goleada.textContent).toMatch(/em \d{2}\/11\/2026/);
  const falta = itens[0];
  expect(falta.getAttribute('aria-disabled')).toBe('true');
  expect(falta.textContent).toContain('Vença seu primeiro jogo.');
  expect(document.querySelectorAll('.conquistas li[aria-disabled="true"]')).toHaveLength(7);
});

test('Rei do bolão mostra "×2"; com 1 vez, sem selo; nenhuma conquista mostra a dica', async () => {
  const rei = (vezes: number) => ({ tipo: 'REI_BOLAO', nome: 'Rei do bolão', vezes, ultimaEm: '2026-11-03T15:00:00Z' });
  fetchFalso({ 'GET /pessoas/u9': pessoa({ conquistas: [rei(2)] }) });
  render(<PerfilPessoa id="u9" />);
  expect(await screen.findByText('×2')).toBeTruthy();
  cleanup();
  fetchFalso({ 'GET /pessoas/u9': pessoa({ conquistas: [rei(1)] }) });
  render(<PerfilPessoa id="u9" />);
  await screen.findByText('Conquistas · 1 de 8');
  expect(screen.queryByText(/^×/)).toBeNull();
  cleanup();
  fetchFalso({ 'GET /pessoas/u9': pessoa() });
  render(<PerfilPessoa id="u9" />);
  expect(await screen.findByText('Poste, vença e palpite para ganhar a primeira.')).toBeTruthy();
});

test('/perfil mostra o próprio nível e o card abre o perfil público', async () => {
  fetchFalso({ 'GET /trocas/minhas': [], 'GET /pessoas/a1': pessoa({ id: 'a1', nivel: nivel(412, 'Técnico', 300, 700) }) });
  const me = { id: 'a1', nome: 'Fabio', email: 'f@x.com', avatarUrl: null, isAdmin: false, pushEnabled: false, clube };
  render(<Perfil me={me} recarregar={() => {}} />);
  await waitFor(() => expect(screen.getByRole('progressbar').getAttribute('aria-label')).toBe('Técnico, 412 de 700 XP'));
  expect(screen.getByRole('progressbar').closest('a')!.getAttribute('href')).toBe('/u/a1');
});

test('/perfil segue sem o card se o nível falhar', async () => {
  fetchFalso({ 'GET /trocas/minhas': [], 'GET /pessoas/a1': { status: 500, corpo: { codigo: 'ERRO' } } });
  const me = { id: 'a1', nome: 'Fabio', email: 'f@x.com', avatarUrl: null, isAdmin: false, pushEnabled: false, clube };
  render(<Perfil me={me} recarregar={() => {}} />);
  expect(await screen.findByText('Conta')).toBeTruthy();
  expect(screen.queryByRole('progressbar')).toBeNull();
});

test('atividade CONQUISTA: troféu, "Você conquistou Goleada." e leva ao próprio perfil', async () => {
  const item = { id: 'c1', tipo: 'CONQUISTA', criadoEm: new Date().toISOString(), lida: false, ator: null, post: null, votacao: null, conquista: { tipo: 'GOLEADA', nome: 'Goleada' } };
  fetchFalso({ 'GET /atividade': { itens: [item], proximo: null }, 'POST /atividade/lidas': { status: 204 } });
  render(<Atividade meuId="a1" />);
  expect(await screen.findByText(/Você conquistou/)).toBeTruthy();
  expect(document.querySelector('.texto-ativ')!.textContent).toBe('Você conquistou Goleada.');
  expect(document.querySelector('.texto-ativ b')!.textContent).toBe('Goleada');
  expect(document.querySelector('a.item-ativ')!.getAttribute('href')).toBe('/u/a1');
  expect(document.querySelector('.av-ativ .trofeu-ativ')).not.toBeNull();
});

test('ícones novos (nivel, trofeu, responder) seguem a regra 24/24 e aria-hidden', () => {
  for (const f of ['nivel', 'trofeu', 'responder']) {
    expect(readdirSync('src/icones')).toContain(`${f}.svg`);
    const raiz = readFileSync(`src/icones/${f}.svg`, 'utf8').match(/<svg[^>]*>/)![0];
    expect(raiz).toMatch(/\swidth="24"/);
    expect(raiz).toMatch(/\sheight="24"/);
    expect(raiz).toMatch(/aria-hidden="true"/);
  }
});

test('CSS: no /perfil o card de nível não soma margem ao padding do .tela; a conquista ganha tem borda de 1,5px (1px + 0,5px de sombra)', () => {
  const css = readFileSync('src/pessoa/pessoa.css', 'utf8');
  expect(css).toMatch(/\.perfil \.nivel-selo \{ margin: 0; \}/);
  expect(css).toMatch(/\.conq\.ganha \{ border: 1px solid var\(--im-gramado\); box-shadow: inset 0 0 0 \.5px var\(--im-gramado\)/);
});
