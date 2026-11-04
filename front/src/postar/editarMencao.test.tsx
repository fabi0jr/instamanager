import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { fetchFalso } from '../testes/fetchFalso';
import { EditarPost } from './EditarPost';

const clube = { id: 'palmeiras', nome: 'Palmeiras', escudoUrl: '/escudos/palmeiras.svg' };
const ID = '11111111-1111-4111-8111-111111111111';
const post = { id: 'p1', clube, autor: { id: 'u1', nome: 'L' }, legenda: `Boa @[Nome Antigo](${ID})!`, mencoes: [{ id: ID, nome: 'Fabio' }], criadoEm: new Date().toISOString(), imagens: [{ id: 'i1', miniUrl: '/m.jpg', cheiaUrl: '/c.jpg', largura: 1, altura: 1, prompt: null }], curtidas: 0, curtiu: false, comentarios: 0, podeEditar: true };

beforeEach(() => { history.replaceState(null, '', '/p/p1/editar'); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

test('editar post com menção mostra @Nome (nome do banco), não o markup; salvar manda a marca de volta no PATCH', async () => {
  const chamadas = fetchFalso({ 'GET /posts/p1': post, 'PATCH /posts/p1': post, 'GET /pessoas?q=pa': [{ id: '22222222-2222-4222-8222-222222222222', nome: 'Paulo', avatarUrl: null, clube: null }] });
  render(<EditarPost id="p1" />);
  const campo = (await screen.findByLabelText('Legenda')) as HTMLTextAreaElement;
  expect(campo.value).toBe('Boa @Fabio!');
  expect(campo.value).not.toContain('](');
  expect((screen.getByRole('button', { name: 'Salvar alterações' }) as HTMLButtonElement).disabled).toBe(true); // abrir não é mudar
  // o Autocompletar existe: digitar @pa abre a lista de pessoas
  fireEvent.change(campo, { target: { value: 'Boa @Fabio! @pa' } });
  campo.setSelectionRange(15, 15);
  fireEvent.change(campo, { target: { value: 'Boa @Fabio! @pa' } });
  fireEvent.click(await screen.findByRole('option', { name: /Paulo/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }));
  await waitFor(() => expect(chamadas.some((c) => c.chave === 'PATCH /posts/p1')).toBe(true));
  const corpo = JSON.parse(chamadas.find((c) => c.chave === 'PATCH /posts/p1')!.body as string);
  expect(corpo.legenda).toBe(`Boa @[Fabio](${ID})! @[Paulo](22222222-2222-4222-8222-222222222222) `); // o autocompletar deixa um espaço depois do chip
});

test('editar sem mexer nas menções mantém a marca (id) no PATCH', async () => {
  const chamadas = fetchFalso({ 'GET /posts/p1': post, 'PATCH /posts/p1': post });
  render(<EditarPost id="p1" />);
  const campo = (await screen.findByLabelText('Legenda')) as HTMLTextAreaElement;
  fireEvent.change(campo, { target: { value: 'Boa @Fabio!!' } });
  fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }));
  await waitFor(() => expect(chamadas.some((c) => c.chave === 'PATCH /posts/p1')).toBe(true));
  expect(JSON.parse(chamadas.find((c) => c.chave === 'PATCH /posts/p1')!.body as string).legenda).toBe(`Boa @[Fabio](${ID})!!`);
});
