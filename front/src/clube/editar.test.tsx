import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type { Me } from '../api/cliente';
import { fetchFalso } from '../testes/fetchFalso';
import { EditarClube } from './EditarClube';
import { PerfilClube } from './PerfilClube';

vi.mock('../postar/comprimir', async (original) => {
  const real = await original<typeof import('../postar/comprimir')>();
  return { ...real, comprimirCapa: vi.fn(async (f: File) => { if (f.name.endsWith('.heic')) throw new real.ErroImagem('x'); return new Blob(['capa'], { type: 'image/jpeg' }); }) };
});

const base = { id: 'palmeiras', nome: 'Palmeiras', escudoUrl: '/escudos/palmeiras.svg', historico: [] };
const abel = { id: 'u1', nome: 'Abel' };
const eu = (extra: Partial<Me> = {}): Me => ({ id: 'u9', nome: 'Eu', email: 'e@x.com', avatarUrl: null, isAdmin: false, pushEnabled: false, clube: null, ...extra });
const clube = (extra = {}) => ({ ...base, tecnico: abel, bio: null, capaUrl: null, ...extra });
const rotasPerfil = (c: object) => ({ 'GET /clubes/palmeiras': c, 'GET /posts?clube=palmeiras': { itens: [], proximo: null }, 'GET /trocas/minhas': [] });

beforeEach(() => vi.stubGlobal('IntersectionObserver', class { observe() {} disconnect() {} unobserve() {} }));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

test('perfil: bio e capa aparecem; técnico atual e admin veem Editar clube; visitante e ex-técnico não', async () => {
  fetchFalso(rotasPerfil(clube({ bio: 'O maior campeão do Brasil', capaUrl: '/uploads/capa.jpg' })));
  const { container, rerender } = render(<PerfilClube id="palmeiras" me={eu({ id: 'u1', clube: { id: 'palmeiras', nome: 'Palmeiras', escudoUrl: '' } })} />);
  expect(await screen.findByText('O maior campeão do Brasil')).toBeTruthy();
  expect(container.querySelector<HTMLElement>('.clube-capa')?.style.backgroundImage).toContain('/uploads/capa.jpg');
  expect(screen.getByRole('link', { name: 'Editar clube' }).getAttribute('href')).toBe('/c/palmeiras/editar');
  rerender(<PerfilClube id="palmeiras" me={eu({ isAdmin: true })} />);
  expect(screen.getByRole('link', { name: 'Editar clube' })).toBeTruthy();
  rerender(<PerfilClube id="palmeiras" me={eu()} />); // visitante / ex-técnico (id diferente do técnico atual)
  expect(screen.queryByRole('link', { name: 'Editar clube' })).toBeNull();
});

test('perfil sem bio: visitante não vê nada; técnico atual vê "Adicionar bio"', async () => {
  fetchFalso(rotasPerfil(clube()));
  const { container, rerender } = render(<PerfilClube id="palmeiras" me={eu()} />);
  await screen.findByText('Abel');
  expect(screen.queryByText('Adicionar bio')).toBeNull();
  expect(container.querySelector('.clube-capa')?.hasAttribute('data-sem-capa')).toBe(true); // gradiente de reserva
  rerender(<PerfilClube id="palmeiras" me={eu({ id: 'u1' })} />);
  expect(screen.getByRole('link', { name: 'Adicionar bio' })).toBeTruthy();
});

test('editar: contador 300 bloqueia Salvar acima do limite; salvar envia PATCH {bio}', async () => {
  const chamadas = fetchFalso({ 'GET /clubes/palmeiras': clube({ bio: 'oi' }), 'PATCH /clubes/palmeiras': clube() });
  render(<EditarClube id="palmeiras" me={eu({ id: 'u1' })} />);
  const campo = (await screen.findByLabelText('Bio do clube')) as HTMLTextAreaElement;
  expect(campo.value).toBe('oi');
  fireEvent.change(campo, { target: { value: 'a'.repeat(312) } });
  expect(screen.getByText('312/300. Corte 12 caracteres.')).toBeTruthy();
  expect((screen.getByRole('button', { name: 'Salvar alterações' }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.change(campo, { target: { value: ' nova bio ' } });
  fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }));
  await waitFor(() => expect(chamadas.map((c) => c.chave)).toContain('PATCH /clubes/palmeiras'));
  expect(JSON.parse(String(chamadas.find((c) => c.chave === 'PATCH /clubes/palmeiras')!.body))).toEqual({ bio: 'nova bio' });
});

test('editar: trocar capa comprime (comprimirCapa) e envia PUT multipart "capa"; ilegível mostra o aviso', async () => {
  const chamadas = fetchFalso({ 'GET /clubes/palmeiras': clube(), 'PUT /clubes/palmeiras/capa': clube({ capaUrl: '/uploads/nova.jpg' }) });
  const { container } = render(<EditarClube id="palmeiras" me={eu({ id: 'u1' })} />);
  const input = await screen.findByLabelText('Escolher capa');
  fireEvent.change(input, { target: { files: [new File(['x'], 'foto.jpg', { type: 'image/jpeg' })] } });
  await waitFor(() => expect(container.querySelector<HTMLElement>('.previa-capa')?.style.backgroundImage).toContain('/uploads/nova.jpg'));
  const put = chamadas.find((c) => c.chave === 'PUT /clubes/palmeiras/capa')!;
  expect((put.body as FormData).get('capa')).toBeInstanceOf(Blob);
  fireEvent.change(input, { target: { files: [new File(['x'], 'foto.heic')] } });
  expect(await screen.findByText('Não deu para ler essa imagem. Escolha outra.')).toBeTruthy();
});

test('editar: ex-técnico (403 NAO_E_TECNICO) vê o aviso e os campos travados; quem não é técnico já abre travado', async () => {
  fetchFalso({ 'GET /clubes/palmeiras': clube(), 'PATCH /clubes/palmeiras': { status: 403, corpo: { codigo: 'NAO_E_TECNICO', mensagem: 'x' } } });
  render(<EditarClube id="palmeiras" me={eu({ id: 'u1' })} />);
  fireEvent.change(await screen.findByLabelText('Bio do clube'), { target: { value: 'x' } });
  fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }));
  expect(await screen.findByText('Você não é mais técnico deste clube.')).toBeTruthy();
  expect((screen.getByLabelText('Bio do clube') as HTMLTextAreaElement).closest('fieldset')!.disabled).toBe(true);
  cleanup();
  fetchFalso({ 'GET /clubes/palmeiras': clube() });
  render(<EditarClube id="palmeiras" me={eu()} />);
  expect(await screen.findByText('Você não é mais técnico deste clube.')).toBeTruthy();
  expect((screen.getByLabelText('Bio do clube') as HTMLTextAreaElement).closest('fieldset')!.disabled).toBe(true);
});
