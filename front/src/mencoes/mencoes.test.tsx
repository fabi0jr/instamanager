import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type { Me } from '../api/cliente';
import { Comentarios } from '../feed/Comentarios';
import { Texto } from '../feed/Texto';
import { fetchFalso } from '../testes/fetchFalso';

const me: Me = { id: 'u1', nome: 'Lincoln', email: 'l@x.com', avatarUrl: null, isAdmin: false, pushEnabled: false, clube: null };
const ID = '11111111-1111-4111-8111-111111111111';
const pessoas = [{ id: ID, nome: 'Fabio', avatarUrl: null, clube: { id: 'santos', nome: 'Santos', escudoUrl: '/escudos/santos.svg' } }, { id: '22222222-2222-4222-8222-222222222222', nome: 'Fabiana', avatarUrl: null, clube: null }];

beforeEach(() => vi.stubGlobal('IntersectionObserver', class { observe() {} disconnect() {} unobserve() {} }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers(); });

test('digitar @fa mostra pessoas e escolher insere @[Nome](id) no comentário enviado', async () => {
  const chamadas = fetchFalso({
    'GET /posts/p1/comentarios': [],
    'GET /pessoas?q=fa': pessoas,
    'POST /posts/p1/comentarios': { id: 'c1', texto: 'x', criadoEm: new Date().toISOString(), usuario: { id: 'u1', nome: 'Lincoln', avatarUrl: null, clube: null } },
  });
  render(<Comentarios postId="p1" me={me} aoFechar={() => {}} aoContar={() => {}} />);
  const campo = (await screen.findByLabelText('Comente como Lincoln')) as HTMLTextAreaElement;
  fireEvent.change(campo, { target: { value: 'Boa @' } });
  expect(await screen.findByText('Digite 2 letras do nome para buscar uma pessoa.')).toBeTruthy();
  campo.setSelectionRange(8, 8);
  fireEvent.change(campo, { target: { value: 'Boa @fa' } });
  campo.setSelectionRange(7, 7);
  fireEvent.change(campo, { target: { value: 'Boa @fa' } });
  const opcao = await screen.findByRole('option', { name: /Fabio/ });
  expect(screen.getAllByRole('option')).toHaveLength(2);
  expect(screen.getByText('torcedor')).toBeTruthy();
  fireEvent.click(opcao);
  expect(campo.value).toBe('Boa @Fabio ');
  fireEvent.click(screen.getByRole('button', { name: 'Publicar' }));
  await waitFor(() => expect(chamadas.some((c) => c.chave === 'POST /posts/p1/comentarios')).toBe(true));
  expect(JSON.parse(chamadas.find((c) => c.chave === 'POST /posts/p1/comentarios')!.body as string).texto).toBe(`Boa @[Fabio](${ID})`);
});

test('a lista de pessoas e o campo vivem na folha por portal (acima da barra)', async () => {
  fetchFalso({ 'GET /posts/p1/comentarios': [], 'GET /pessoas?q=fa': pessoas });
  render(<Comentarios postId="p1" me={me} aoFechar={() => {}} aoContar={() => {}} />);
  const campo = (await screen.findByLabelText('Comente como Lincoln')) as HTMLTextAreaElement;
  fireEvent.change(campo, { target: { value: '@fa' } });
  campo.setSelectionRange(3, 3);
  fireEvent.change(campo, { target: { value: '@fa' } });
  await screen.findByRole('option', { name: /Fabio/ });
  expect(document.querySelector('body > .veu .mencao-lista')).toBeTruthy();
});

test('apagar uma vez remove o chip inteiro', async () => {
  fetchFalso({ 'GET /posts/p1/comentarios': [], 'GET /pessoas?q=fa': pessoas });
  render(<Comentarios postId="p1" me={me} aoFechar={() => {}} aoContar={() => {}} />);
  const campo = (await screen.findByLabelText('Comente como Lincoln')) as HTMLTextAreaElement;
  fireEvent.change(campo, { target: { value: 'oi @fa' } });
  campo.setSelectionRange(6, 6);
  fireEvent.change(campo, { target: { value: 'oi @fa' } });
  fireEvent.click(await screen.findByRole('option', { name: /Fabio/ }));
  campo.setSelectionRange(campo.value.length, campo.value.length);
  fireEvent.keyDown(campo, { key: 'Backspace' });
  expect(campo.value).toBe('oi ');
});

test('texto mostra a menção como chip com o nome do banco (mencoes), não o do texto; id forjado vira "@pessoa removida"', () => {
  const OUTRO = '33333333-3333-4333-8333-333333333333';
  render(<p><Texto mencoes={[{ id: ID, nome: 'Fabio Araujo' }]}>{`Oi @[Presidente](${ID}) e @[Fantasma](${OUTRO}) #tag`}</Texto></p>);
  const chips = document.querySelectorAll('.chip-mencao');
  expect(chips[0].textContent).toBe('@Fabio Araujo'); // nome do banco
  expect(chips[1].textContent).toBe('@pessoa removida');
  expect(chips[1].classList.contains('removida')).toBe(true);
  expect(document.body.textContent).not.toContain('Presidente');
  expect(document.querySelector('a.hashtag')?.textContent).toBe('#tag');
});

test('sem "mencoes" (ex.: bio do clube) a marca vira "@pessoa removida", nunca o nome escrito no texto', () => {
  render(<p><Texto>{`Oi @[Presidente](${ID})`}</Texto></p>);
  expect(document.querySelector('.chip-mencao')?.textContent).toBe('@pessoa removida');
  expect(document.body.textContent).not.toContain('Presidente');
});
