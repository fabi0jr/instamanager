import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import type { Me } from '../api/cliente';
import { fetchFalso } from '../testes/fetchFalso';
import { Admin } from './Admin';

const admin: Me = { id: 'a', nome: 'Adm', email: 'a@x.com', avatarUrl: null, isAdmin: true, pushEnabled: false, clube: null };
const acao = (id: string, extra = {}) => ({ id, ferramenta: 'criar_post', resumo: 'texto: Bora', ok: true, erro: null, criadaEm: new Date().toISOString(), ...extra });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

test('início do admin tem a linha "Ações da CBF via MCP" para /admin/mcp', async () => {
  fetchFalso({ 'GET /admin/trocas?status=PENDENTE': [], 'GET /admin/denuncias?abertas=1': { itens: [], proximo: null }, 'GET /admin/convite': { codigo: null }, 'GET /clubes': [] });
  render(<Admin me={admin} caminho="/admin" />);
  expect((await screen.findByRole('link', { name: /Ações da CBF via MCP/ })).getAttribute('href')).toBe('/admin/mcp');
});

test('log lista ok e erro com palavra, ferramenta e mensagem', async () => {
  fetchFalso({ 'GET /admin/mcp': [acao('1'), acao('2', { ferramenta: 'lancar_placares', resumo: 'rodada 12', ok: false, erro: 'Rodada fechada' })] });
  render(<Admin me={admin} caminho="/admin/mcp" />);
  const itens = await screen.findAllByRole('listitem');
  expect(itens).toHaveLength(2);
  expect(within(itens[0]).getByText('criar_post')).toBeTruthy();
  expect(within(itens[0]).getByText('ok')).toBeTruthy();
  expect(within(itens[1]).getByText('erro')).toBeTruthy();
  expect(within(itens[1]).getByText('Rodada fechada')).toBeTruthy();
});

test('vazio, erro com tentar de novo', async () => {
  fetchFalso({ 'GET /admin/mcp': [] });
  render(<Admin me={admin} caminho="/admin/mcp" />);
  expect(await screen.findByText('Nenhuma ação da CBF via MCP ainda.')).toBeTruthy();
  cleanup();
  fetchFalso({ 'GET /admin/mcp': { status: 500 } });
  render(<Admin me={admin} caminho="/admin/mcp" />);
  expect(await screen.findByText('Não deu para carregar o log')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeTruthy();
});
