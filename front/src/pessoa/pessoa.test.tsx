import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { Texto } from '../feed/Texto';
import { fetchFalso } from '../testes/fetchFalso';
import { PerfilPessoa } from './PerfilPessoa';

const clube = (id: string, nome: string) => ({ id, nome, escudoUrl: `/escudos/${id}.svg` });
const post = (id: string) => ({ id, clube: clube('santos', 'Santos'), autor: { id: 'u9', nome: 'Marcos' }, legenda: 'x', imagens: [{ id: id + 'i', miniUrl: `/m${id}.jpg`, cheiaUrl: `/c${id}.jpg`, largura: 1, altura: 1, prompt: null }], curtidas: 0, curtiu: false, comentarios: 0, podeEditar: false, criadoEm: new Date().toISOString() });
const pessoa = (extra = {}) => ({
  id: 'u9', nome: 'Marcos Silva', avatarUrl: null, clube: clube('santos', 'Santos'),
  historico: [{ clube: clube('santos', 'Santos'), inicio: '2026-11-03T12:00:00Z', fim: null }, { clube: clube('vasco', 'Vasco'), inicio: '2026-09-10T12:00:00Z', fim: '2026-11-02T12:00:00Z' }],
  posts: { itens: [post('p1'), post('p2')], proximo: null }, ...extra,
});
beforeEach(() => vi.stubGlobal('IntersectionObserver', class { observe() {} disconnect() {} unobserve() {} }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

test('perfil mostra nome, clube, histórico (mais novo primeiro) e a grade de posts, sem e-mail', async () => {
  fetchFalso({ 'GET /pessoas/u9': pessoa({ email: 'segredo@x.com' }) });
  render(<PerfilPessoa id="u9" />);
  expect(await screen.findByRole('heading', { name: 'Marcos Silva' })).toBeTruthy();
  expect(screen.getByLabelText('Clube Santos')).toBeTruthy();
  const passagens = [...document.querySelectorAll('.passagens li')].map((l) => l.textContent);
  expect(passagens[0]).toContain('Santos');
  expect(passagens[0]).toContain('até hoje');
  expect(passagens[1]).toContain('Vasco');
  expect(passagens[1]).toContain(' a ');
  expect(screen.getByText(/técnico desde/)).toBeTruthy();
  expect(screen.getAllByRole('link').map((a) => a.getAttribute('href'))).toEqual(['/p/p1', '/p/p2']);
  expect(document.body.textContent).not.toContain('segredo@x.com');
});

test('torcedor sem clube, sem histórico e sem post mostra os vazios', async () => {
  fetchFalso({ 'GET /pessoas/u9': pessoa({ clube: null, historico: [], posts: { itens: [], proximo: null } }) });
  render(<PerfilPessoa id="u9" />);
  expect(await screen.findByText('Torcedor, sem clube')).toBeTruthy();
  expect(screen.getByText('Ainda não treinou nenhum clube.')).toBeTruthy();
  expect(screen.getByText('Ainda não tem post')).toBeTruthy();
  expect(screen.getByText('Quando Marcos publicar, os posts aparecem aqui.')).toBeTruthy();
});

test('carregando mostra esqueleto; 404 vira "Essa pessoa não está aqui"; erro tem Tentar de novo', async () => {
  fetchFalso({ 'GET /pessoas/x': { status: 404, corpo: { codigo: 'NAO_ENCONTRADO', mensagem: 'x' } } });
  const { container } = render(<PerfilPessoa id="x" />);
  expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
  expect(await screen.findByText('Essa pessoa não está aqui')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Voltar ao feed' })).toBeTruthy();
  cleanup();
  let n = 0;
  fetchFalso({ 'GET /pessoas/y': () => (n++ ? pessoa() : { status: 500, corpo: { codigo: 'ERRO' } }) });
  render(<PerfilPessoa id="y" />);
  fireEvent.click(await screen.findByRole('button', { name: 'Tentar de novo' }));
  expect(await screen.findByRole('heading', { name: 'Marcos Silva' })).toBeTruthy();
});

test('"Ver mais posts" busca a próxima página pelo cursor e junta', async () => {
  const chamadas = fetchFalso({
    'GET /pessoas/u9': pessoa({ posts: { itens: [post('p1')], proximo: 'cur1' } }),
    'GET /pessoas/u9?antes=cur1': pessoa({ posts: { itens: [post('p2')], proximo: null } }),
  });
  render(<PerfilPessoa id="u9" />);
  fireEvent.click(await screen.findByRole('button', { name: 'Ver mais posts' }));
  await waitFor(() => expect(document.querySelectorAll('.grade-capas a')).toHaveLength(2));
  expect(chamadas.map((c) => c.chave)).toContain('GET /pessoas/u9?antes=cur1');
  expect(screen.queryByRole('button', { name: 'Ver mais posts' })).toBeNull();
});

test('menção em texto vira link para /u/:id; menção removida continua sem link', () => {
  const ID = '11111111-1111-4111-8111-111111111111', OUTRO = '33333333-3333-4333-8333-333333333333';
  render(<p><Texto mencoes={[{ id: ID, nome: 'Fabio' }]}>{`Oi @[x](${ID}) e @[y](${OUTRO})`}</Texto></p>);
  const a = document.querySelector('a.chip-mencao')!;
  expect(a.getAttribute('href')).toBe(`/u/${ID}`);
  expect(document.querySelector('span.chip-mencao.removida')).not.toBeNull();
});
