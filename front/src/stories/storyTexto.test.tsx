import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type { Me } from '../api/cliente';
import { fetchFalso } from '../testes/fetchFalso';
import { CriarStory } from './CriarStory';
import { Visualizador } from './Visualizador';
import type { FaixaClube } from './tipos';

const clube = { id: 'santos', nome: 'Santos', escudoUrl: '/escudos/santos.svg' };
const tecnico: Me = { id: 'u1', nome: 'Lincoln', email: 'l@x.com', avatarUrl: null, isAdmin: false, pushEnabled: false, clube };

let envios: FormData[] = [];
let resposta = { status: 201, corpo: '{"id":"s1"}' };
class FakeXhr {
  upload: { onprogress?: (e: unknown) => void } = {};
  status = 0; responseText = '';
  onload?: () => void; onerror?: () => void; onabort?: () => void;
  open = vi.fn();
  abort = vi.fn();
  send(form: FormData) {
    envios.push(form);
    queueMicrotask(() => { this.status = resposta.status; this.responseText = resposta.corpo; this.onload?.(); });
  }
}
beforeEach(() => {
  envios = []; resposta = { status: 201, corpo: '{"id":"s1"}' };
  vi.stubGlobal('XMLHttpRequest', FakeXhr);
  history.replaceState(null, '', '/stories/novo');
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const campo = () => screen.getByLabelText('Texto do story') as HTMLTextAreaElement;
const digitar = (t: string) => fireEvent.change(campo(), { target: { value: t } });
const abrirTexto = (me = tecnico) => { render(<CriarStory me={me} />); fireEvent.click(screen.getByRole('button', { name: /Texto/ })); };

test('escolher Texto, digitar e escolher o fundo envia o multipart {texto, fundo}', async () => {
  abrirTexto();
  expect((screen.getByRole('button', { name: 'Publicar story' }) as HTMLButtonElement).disabled).toBe(true); // vazio
  digitar('  Bora, Santos!  ');
  fireEvent.click(screen.getByRole('radio', { name: 'Azul' }));
  expect(screen.getByRole('radio', { name: 'Azul' }).getAttribute('aria-checked')).toBe('true');
  fireEvent.click(screen.getByRole('button', { name: 'Publicar story' }));
  await waitFor(() => expect(envios).toHaveLength(1));
  expect(envios[0].get('texto')).toBe('Bora, Santos!'); // cortado nas pontas
  expect(envios[0].get('fundo')).toBe('azul');
  expect(envios[0].get('imagem')).toBeNull();
  expect(envios[0].get('comoCbf')).toBeNull();
});

test('só espaços não publica; fundo padrão é Gramado', () => {
  abrirTexto();
  expect(screen.getByRole('radio', { name: 'Gramado' }).getAttribute('aria-checked')).toBe('true');
  digitar('   ');
  expect((screen.getByRole('button', { name: 'Publicar story' }) as HTMLButtonElement).disabled).toBe(true);
});

test('contador chega a 200 e o campo não aceita mais', () => {
  abrirTexto();
  expect(campo().maxLength).toBe(200);
  digitar('a'.repeat(200));
  expect(screen.getByText('200/200')).toBeTruthy();
  expect(screen.getByText('Limite de 200 caracteres').getAttribute('aria-live')).toBe('polite'); // só o aviso é anunciado, não cada tecla
  expect(screen.getByText('200/200').closest('[aria-live]')).toBeNull();
  digitar('a'.repeat(205)); // colar além do limite é cortado
  expect(campo().value).toHaveLength(200);
});

test('admin posta como CBF: comoCbf vai junto', async () => {
  abrirTexto({ ...tecnico, isAdmin: true });
  digitar('Rodada fechada');
  fireEvent.click(screen.getByRole('switch', { name: 'Postar como CBF' }));
  fireEvent.click(screen.getByRole('button', { name: 'Publicar story' }));
  await waitFor(() => expect(envios).toHaveLength(1));
  expect(envios[0].get('comoCbf')).toBe('true');
});

test('erro do servidor mantém o texto no campo e oferece tentar de novo', async () => {
  resposta = { status: 500, corpo: '{}' };
  abrirTexto();
  digitar('Meu texto');
  fireEvent.click(screen.getByRole('button', { name: 'Publicar story' }));
  expect(await screen.findByText('Não deu para publicar o story')).toBeTruthy();
  expect(campo().value).toBe('Meu texto');
  expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeTruthy();
});

test('o campo não aceita a 9ª linha; seta para baixo troca o fundo; enviando trava o campo', async () => {
  abrirTexto();
  digitar('1\n2\n3\n4\n5\n6\n7\n8');
  digitar('1\n2\n3\n4\n5\n6\n7\n8\n9');
  expect(campo().value).toBe('1\n2\n3\n4\n5\n6\n7\n8');
  fireEvent.keyDown(screen.getByRole('radio', { name: 'Gramado' }), { key: 'ArrowDown' });
  expect(screen.getByRole('radio', { name: 'Carvão' }).getAttribute('aria-checked')).toBe('true');
  fireEvent.click(screen.getByRole('button', { name: 'Publicar story' }));
  expect(await screen.findByRole('button', { name: /Publicando/ })).toBeTruthy();
  expect(campo().disabled).toBe(true);
  expect(screen.queryByRole('progressbar')).toBeNull();
});

const faixa = (texto: string, fundo: string): FaixaClube[] => [{ clube: { id: 'vasco', nome: 'vasco', escudoUrl: '' }, todosVistos: false, stories: [{ id: 'a', tipo: 'TEXTO', url: null, texto, fundo, capaUrl: null, criadoEm: '2026-11-04T10:00:00Z', visto: false }] as unknown as FaixaClube['stories'] }];
const abrirVis = async (texto: string, fundo: string) => {
  fetchFalso({ 'GET /stories': faixa(texto, fundo), 'PUT /stories/a/visto': { status: 204 } });
  render(<Visualizador clubeId="vasco" me={tecnico} />);
  return (await screen.findByText((_, el) => el?.tagName === 'P' && el.classList.contains('vis-texto'))) as HTMLElement;
};

test('visualizador mostra o texto como <p> com quebras de linha e a classe do fundo', async () => {
  const p = await abrirVis('Linha 1\nLinha 2', 'vermelho');
  expect(p.textContent).toBe('Linha 1\nLinha 2');
  expect(p.closest('.visualizador')!.classList.contains('fundo-vermelho')).toBe(true);
});

// Review Focus 5: texto longo cabe em 320 px porque o tamanho cai em 3 faixas
test.each([['1\n2\n3\n4', 't40'], ['1\n2\n3\n4\n5\n6\n7\n8', 't30'], ['a\nb\nc', 't56'], ['a'.repeat(100) + '\n\n\n\n', 't40'], ['a'.repeat(60), 't56'], ['a'.repeat(61), 't40'], ['a'.repeat(120), 't40'], ['a'.repeat(121), 't30'], ['a'.repeat(200), 't30']])('tamanho do texto de %#: %s', async (texto, classe) => {
  const p = await abrirVis(texto, 'gramado');
  expect(p.classList.contains(classe)).toBe(true);
});
