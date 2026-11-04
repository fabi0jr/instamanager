import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { App } from './App';
import { Cadastro } from './conta/Cadastro';
import { CHAVE_NOVIDADES, NOVIDADES } from './novidades';

const me = { id: '1', nome: 'Lincoln', email: 'l@x.com', avatarUrl: null, isAdmin: false, pushEnabled: false, clube: { id: 'palmeiras', nome: 'Palmeiras', escudoUrl: '/e.svg' } };
const TITULO = 'Novidades do InstaManager';

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('im:instalar-visto', '1'); // aparelho que já passou por /instalar
  vi.stubGlobal('IntersectionObserver', class { observe() {} disconnect() {} unobserve() {} });
  // cada rota devolve o formato real (lista, objeto ou página): formato errado vira erro não tratado nas telas
  const postUnico = { id: 'abc', clube: me.clube, autor: { id: '1', nome: 'L' }, legenda: 'x', texto: null, criadoEm: new Date().toISOString(), imagens: [], curtidas: 0, curtiu: false, reacoes: [], minhaReacao: null, comentarios: 0, podeEditar: true };
  const corpo = (u: string): unknown =>
    u === '/api/me' ? me
    : u === '/api/trocas/minhas' ? []
    : u.startsWith('/api/clubes/') ? { ...me.clube, bio: null, capaUrl: null, tecnico: { id: '1', nome: 'L' }, historico: [] }
    : /^\/api\/posts\/[^/?]+$/.test(u) ? postUnico
    : { itens: [], proximo: null };
  vi.stubGlobal('fetch', vi.fn(async (u: string) => new Response(JSON.stringify(corpo(u)))));
});
afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

async function abrir(caminho = '/') {
  history.pushState(null, '', caminho);
  render(<App />);
  await screen.findByRole('navigation', { name: 'Principal' });
}

test('mostra as novidades uma vez; "Bora!" grava o id e não abre de novo', async () => {
  await abrir();
  const dialogo = await screen.findByRole('dialog', { name: TITULO });
  for (const item of NOVIDADES.itens) expect(dialogo.textContent).toContain(item);
  fireEvent.click(screen.getByRole('button', { name: 'Bora!' }));
  expect(screen.queryByRole('dialog', { name: TITULO })).toBeNull();
  expect(localStorage.getItem(CHAVE_NOVIDADES)).toBe(NOVIDADES.id);
  cleanup();
  await abrir(); // "depois de atualizar de novo" / reabrir o app
  expect(screen.queryByRole('dialog', { name: TITULO })).toBeNull();
});

test('foco no Bora! ao abrir e Esc fecha (e conta como visto)', async () => {
  await abrir();
  await screen.findByRole('dialog', { name: TITULO });
  await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Bora!' })));
  fireEvent.keyDown(document.body, { key: 'Escape' });
  expect(screen.queryByRole('dialog', { name: TITULO })).toBeNull();
  expect(localStorage.getItem(CHAVE_NOVIDADES)).toBe(NOVIDADES.id);
});

test('id diferente (versão nova) abre de novo', async () => {
  localStorage.setItem(CHAVE_NOVIDADES, 'versao-antiga');
  await abrir();
  expect(await screen.findByRole('dialog', { name: TITULO })).toBeTruthy();
});

test.each(['/postar', '/p/abc/editar', '/c/palmeiras/editar'])('não abre em cima de tela de edição (%s)', async (caminho) => {
  await abrir(caminho);
  await new Promise((r) => setTimeout(r, 50));
  expect(screen.queryByRole('dialog', { name: TITULO })).toBeNull();
  expect(localStorage.getItem(CHAVE_NOVIDADES)).toBeNull(); // continua pendente para depois
});

test.each(['/instalar', '/avisos'])('não abre em cima de %s, mas abre depois que a pessoa sai de lá', async (caminho) => {
  localStorage.removeItem('im:instalar-visto');
  await abrir(caminho);
  await new Promise((r) => setTimeout(r, 50));
  expect(screen.queryByRole('dialog', { name: TITULO })).toBeNull();
  const { navegar } = await import('./rotas');
  localStorage.setItem('im:instalar-visto', '1');
  navegar('/galeria');
  expect(await screen.findByRole('dialog', { name: TITULO })).toBeTruthy();
});

test('cadastro novo grava o id: quem acabou de se cadastrar não vê as novidades', async () => {
  vi.stubGlobal('fetch', vi.fn(async (u: string) => new Response(JSON.stringify(u === '/api/auth/cadastro' ? me : [{ id: 'palmeiras', nome: 'Palmeiras', escudoUrl: '/e.svg', tecnico: null }]), { status: u === '/api/auth/cadastro' ? 201 : 200 })));
  const aoEntrar = vi.fn();
  render(<Cadastro aoEntrar={aoEntrar} />);
  const escreve = (r: string, v: string) => fireEvent.change(screen.getByLabelText(r), { target: { value: v } });
  const clica = (n: string) => fireEvent.click(screen.getByRole('button', { name: n }));
  escreve('Código de convite', 'ABC');
  clica('Continuar');
  escreve('Nome de exibição', 'Lincoln');
  escreve('E-mail', 'l@x.com');
  escreve('Senha', 'senha1234');
  clica('Continuar');
  fireEvent.click(await screen.findByRole('radio', { name: 'Sou só torcedor' }));
  clica('Criar conta');
  await waitFor(() => expect(aoEntrar).toHaveBeenCalled());
  expect(localStorage.getItem(CHAVE_NOVIDADES)).toBe(NOVIDADES.id);
});
