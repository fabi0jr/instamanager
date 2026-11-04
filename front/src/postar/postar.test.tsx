import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type { Me } from '../api/cliente';
import { fetchFalso } from '../testes/fetchFalso';
import { EditarPost } from './EditarPost';
import { Postar } from './Postar';

// comprime "de mentira": o conteúdo do blob diz de qual arquivo e de qual lado veio
vi.mock('./comprimir', async (original) => {
  const real = await original<typeof import('./comprimir')>();
  return {
    ...real,
    comprimir: vi.fn(async (a: File, lado: number) => {
      if (a.name.endsWith('.heic')) throw new real.ErroImagem('x');
      return { blob: new Blob([`${a.name}:${lado}`], { type: 'image/jpeg' }), largura: lado, altura: lado };
    }),
  };
});

const clube = { id: 'palmeiras', nome: 'Palmeiras', escudoUrl: '/escudos/palmeiras.svg' };
const tecnico: Me = { id: 'u1', nome: 'Lincoln', email: 'l@x.com', avatarUrl: null, isAdmin: false, pushEnabled: false, clube };
const torcedor: Me = { ...tecnico, clube: null };

type Envio = { form: FormData; xhr: FakeXhr };
let envios: Envio[] = [];
let resposta: { status: number; corpo: string; perdida?: boolean } = { status: 201, corpo: '{"id":"novo"}' };
class FakeXhr {
  upload: { onprogress?: (e: unknown) => void } = {};
  status = 0;
  responseText = '';
  onload?: () => void;
  onerror?: () => void;
  onabort?: () => void;
  open = vi.fn();
  abort = vi.fn(() => this.onabort?.());
  send(form: FormData) {
    envios.push({ form, xhr: this });
    queueMicrotask(() => {
      const fim = resposta.perdida ? 100 : 50;
      this.upload.onprogress?.({ lengthComputable: true, loaded: fim, total: 100 });
      if (resposta.perdida) return this.onerror?.();
      this.status = resposta.status;
      this.responseText = resposta.corpo;
      this.onload?.();
    });
  }
}

beforeEach(() => {
  envios = [];
  resposta = { status: 201, corpo: '{"id":"novo"}' };
  vi.stubGlobal('XMLHttpRequest', FakeXhr);
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:x'), revokeObjectURL: vi.fn() }));
  history.pushState(null, '', '/postar');
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const arquivo = (nome: string) => new File(['x'], nome, { type: nome.endsWith('heic') ? 'image/heic' : 'image/jpeg' });
const escolher = (...nomes: string[]) => fireEvent.change(screen.getByLabelText('Escolher imagens'), { target: { files: nomes.map(arquivo) } });
const clica = (nome: string | RegExp) => fireEvent.click(screen.getByRole('button', { name: nome }));

test('torcedor abrindo /postar vê "Só técnico posta" e o link para pedir clube', () => {
  render(<Postar me={torcedor} />);
  expect(screen.getByText('Só técnico posta')).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Ver clubes livres' }).getAttribute('href')).toBe('/clubes');
});

test('publicar envia cheia e mini (sem colchetes, mini de 800) na mesma ordem dos prompts', async () => {
  render(<Postar me={tecnico} />);
  escolher('a.jpg', 'b.jpg');
  await waitFor(() => expect((screen.getByRole('button', { name: 'Continuar' }) as HTMLButtonElement).disabled).toBe(false));
  clica('Continuar');
  fireEvent.change(screen.getByLabelText('Legenda'), { target: { value: 'Treino' } });
  fireEvent.click(screen.getAllByRole('button', { name: 'Adicionar prompt' })[1]);
  fireEvent.change(screen.getByLabelText('Prompt da imagem 2'), { target: { value: 'um gol' } });
  clica('Publicar');
  await waitFor(() => expect(envios).toHaveLength(1));

  const f = envios[0].form;
  const textos = async (k: string) => Promise.all((f.getAll(k) as File[]).map((b) => b.text()));
  expect(await textos('cheia')).toEqual(['a.jpg:1600', 'b.jpg:1600']);
  expect(await textos('mini')).toEqual(['a.jpg:800', 'b.jpg:800']);
  expect(JSON.parse(f.get('prompts') as string)).toEqual([null, 'um gol']);
  expect(f.get('legenda')).toBe('Treino');
  await waitFor(() => expect(location.pathname).toBe('/'));
});

test('HEIC ilegível avisa na miniatura e não trava as outras', async () => {
  render(<Postar me={tecnico} />);
  escolher('a.jpg', 'foto-12.heic');
  expect(await screen.findByText('Não deu para ler foto-12.heic. Escolha outra imagem ou exporte como JPEG.')).toBeTruthy();
  expect((screen.getByRole('button', { name: 'Continuar' }) as HTMLButtonElement).disabled).toBe(false);
});

test('mais de 10 imagens: entram as 10 primeiras e avisa', async () => {
  render(<Postar me={tecnico} />);
  escolher(...Array.from({ length: 13 }, (_, i) => `f${i}.jpg`));
  expect(await screen.findByText('O limite é 10 imagens. As 3 últimas ficaram de fora.')).toBeTruthy();
  expect(screen.getAllByRole('button', { name: /^Remover imagem/ })).toHaveLength(10);
});

test('envio que falha mostra Tentar de novo e mantém a legenda', async () => {
  resposta = { status: 500, corpo: '{}' };
  render(<Postar me={tecnico} />);
  escolher('a.jpg');
  await waitFor(() => expect((screen.getByRole('button', { name: 'Continuar' }) as HTMLButtonElement).disabled).toBe(false));
  clica('Continuar');
  fireEvent.change(screen.getByLabelText('Legenda'), { target: { value: 'Oi' } });
  clica('Publicar');
  expect(await screen.findByText('Não deu para publicar')).toBeTruthy();
  resposta = { status: 201, corpo: '{"id":"n"}' };
  clica('Tentar de novo');
  await waitFor(() => expect(envios).toHaveLength(2));
  expect(envios[1].form.get('legenda')).toBe('Oi');
});

test('SEM_CLUBE na publicação mostra "Você não pode publicar agora" sem tentar de novo', async () => {
  resposta = { status: 403, corpo: '{"codigo":"SEM_CLUBE"}' };
  render(<Postar me={tecnico} />);
  escolher('a.jpg');
  await waitFor(() => expect((screen.getByRole('button', { name: 'Continuar' }) as HTMLButtonElement).disabled).toBe(false));
  clica('Continuar');
  clica('Publicar');
  expect(await screen.findByText('Você não pode publicar agora')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Tentar de novo' })).toBeNull();
});

test('legenda acima de 2200 desabilita Publicar e diz quanto cortar', async () => {
  render(<Postar me={tecnico} />);
  escolher('a.jpg');
  await waitFor(() => expect((screen.getByRole('button', { name: 'Continuar' }) as HTMLButtonElement).disabled).toBe(false));
  clica('Continuar');
  fireEvent.change(screen.getByLabelText('Legenda'), { target: { value: 'x'.repeat(2310) } });
  expect(screen.getByText('2310/2200. Corte 110 caracteres.')).toBeTruthy();
  expect((screen.getByRole('button', { name: 'Publicar' }) as HTMLButtonElement).disabled).toBe(true);
});

const postExistente = {
  id: 'p1', clube, autor: { id: 'u1', nome: 'Lincoln' }, legenda: 'Antiga', criadoEm: new Date().toISOString(), curtidas: 0, curtiu: false, comentarios: 0, podeEditar: true,
  imagens: [{ id: 'i1', miniUrl: '/m.jpg', cheiaUrl: '/c.jpg', largura: 10, altura: 10, prompt: 'velho' }],
};

test('editar: Salvar só acende com mudança e envia legenda e prompts', async () => {
  const chamadas = fetchFalso({ 'GET /posts/p1': postExistente, 'PATCH /posts/p1': postExistente });
  render(<EditarPost id="p1" />);
  const salvar = (await screen.findByRole('button', { name: 'Salvar alterações' })) as HTMLButtonElement;
  expect(salvar.disabled).toBe(true);
  fireEvent.change(screen.getByLabelText('Legenda'), { target: { value: 'Nova' } });
  expect(salvar.disabled).toBe(false);
  fireEvent.click(salvar);
  await waitFor(() => expect(chamadas.some((c) => c.chave === 'PATCH /posts/p1')).toBe(true));
  expect(JSON.parse(chamadas.find((c) => c.chave === 'PATCH /posts/p1')!.body as string)).toEqual({ legenda: 'Nova', prompts: ['velho'] });
});

test('editar: NAO_E_TECNICO avisa e desabilita', async () => {
  fetchFalso({ 'GET /posts/p1': postExistente, 'PATCH /posts/p1': { status: 403, corpo: { codigo: 'NAO_E_TECNICO', mensagem: 'x' } } });
  render(<EditarPost id="p1" />);
  fireEvent.change(await screen.findByLabelText('Legenda'), { target: { value: 'Nova' } });
  fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }));
  expect(await screen.findByText(/Você não é mais técnico deste clube/)).toBeTruthy();
  expect((screen.getByRole('button', { name: 'Salvar alterações' }) as HTMLButtonElement).disabled).toBe(true);
});

test('upload chegou a 100% e a resposta se perdeu: não oferece reenviar', async () => {
  resposta = { status: 0, corpo: '', perdida: true };
  render(<Postar me={tecnico} />);
  escolher('a.jpg');
  await waitFor(() => expect((screen.getByRole('button', { name: 'Continuar' }) as HTMLButtonElement).disabled).toBe(false));
  clica('Continuar');
  clica('Publicar');
  expect(await screen.findByText(/Pode ter sido publicado, confira o feed/)).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Tentar de novo' })).toBeNull();
  expect(screen.getByRole('button', { name: 'Ver o feed' })).toBeTruthy();
});

test('remover imagem solta a URL da prévia', async () => {
  render(<Postar me={tecnico} />);
  escolher('a.jpg');
  await waitFor(() => expect(screen.getByRole('button', { name: 'Remover imagem 1' })).toBeTruthy());
  await waitFor(() => expect(URL.createObjectURL).toHaveBeenCalled());
  clica('Remover imagem 1');
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:x');
});

test('com imagens escolhidas aparece o quadro "Adicionar" e some ao chegar em 10', async () => {
  render(<Postar me={tecnico} />);
  expect(screen.queryByText('+ Adicionar')).toBeNull();
  escolher('a.jpg');
  const quadro = await screen.findByText('+ Adicionar');
  expect(quadro.getAttribute('for')).toBe(screen.getByLabelText('Escolher imagens').id);
  escolher(...Array.from({ length: 9 }, (_, i) => `b${i}.jpg`));
  await waitFor(() => expect(screen.getAllByRole('button', { name: /^Remover imagem/ })).toHaveLength(10));
  expect(screen.queryByText('+ Adicionar')).toBeNull();
});

test('editar: quem não pode editar vê o bloqueio já ao abrir', async () => {
  fetchFalso({ 'GET /posts/p1': { ...postExistente, podeEditar: false } });
  render(<EditarPost id="p1" />);
  expect(await screen.findByText(/Você não é mais técnico deste clube/)).toBeTruthy();
  expect((screen.getByRole('button', { name: 'Salvar alterações' }) as HTMLButtonElement).disabled).toBe(true);
});

// ---- modo Texto (IM-33)
const modoTexto = () => fireEvent.click(screen.getByRole('radio', { name: 'Texto' }));
const campoTexto = () => screen.getByPlaceholderText('O que está rolando?');
const publicarBtn = () => screen.getByRole('button', { name: 'Publicar' }) as HTMLButtonElement;

test('modo Texto: um passo só, Publicar desabilitado vazio/só espaços, envia 0 arquivos + texto', async () => {
  localStorage.clear();
  render(<Postar me={tecnico} />);
  modoTexto();
  expect(screen.getByText('Vai sair como Palmeiras, por Lincoln.')).toBeTruthy();
  expect(publicarBtn().disabled).toBe(true);
  fireEvent.change(campoTexto(), { target: { value: '   ' } });
  expect(publicarBtn().disabled).toBe(true);
  fireEvent.change(campoTexto(), { target: { value: 'Bora #Palmeiras' } });
  expect(screen.getByText('15/500')).toBeTruthy();
  expect(publicarBtn().disabled).toBe(false);
  fireEvent.click(publicarBtn());
  await waitFor(() => expect(envios).toHaveLength(1));
  const f = envios[0].form;
  expect(f.get('texto')).toBe('Bora #Palmeiras');
  expect(f.getAll('cheia')).toHaveLength(0);
  expect(f.getAll('mini')).toHaveLength(0);
  await waitFor(() => expect(location.pathname).toBe('/'));
});

test('modo Texto: acima de 500 mostra o contador de corte e bloqueia', () => {
  render(<Postar me={tecnico} />);
  modoTexto();
  fireEvent.change(campoTexto(), { target: { value: 'a'.repeat(512) } });
  expect(screen.getByText('512/500. Corte 12 caracteres.')).toBeTruthy();
  expect(publicarBtn().disabled).toBe(true);
});

test('modo Texto: falha mantém o texto e oferece Tentar de novo', async () => {
  resposta = { status: 500, corpo: '<html>' };
  render(<Postar me={tecnico} />);
  modoTexto();
  fireEvent.change(campoTexto(), { target: { value: 'oi' } });
  fireEvent.click(publicarBtn());
  expect(await screen.findByText('Não deu para publicar. Seu texto continua aqui.')).toBeTruthy();
  expect((campoTexto() as HTMLTextAreaElement).value).toBe('oi');
  resposta = { status: 201, corpo: '{"id":"n"}' };
  fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
  await waitFor(() => expect(envios).toHaveLength(2));
});

test('a alternância Foto | Texto lembra a última escolha', () => {
  localStorage.clear();
  const { unmount } = render(<Postar me={tecnico} />);
  expect(screen.getByRole('radio', { name: 'Foto' }).getAttribute('aria-checked')).toBe('true');
  modoTexto();
  unmount();
  render(<Postar me={tecnico} />);
  expect(screen.getByRole('radio', { name: 'Texto' }).getAttribute('aria-checked')).toBe('true');
  localStorage.clear();
});

test('editar post de texto: edita o texto (1–500) e envia PATCH {texto}, sem legenda/prompts', async () => {
  history.pushState(null, '', '/p/t/editar');
  const chamadas = fetchFalso({
    'GET /posts/t': { id: 't', clube, autor: { id: 'u1', nome: 'Lincoln' }, legenda: '', texto: 'oi', imagens: [], curtidas: 0, curtiu: false, comentarios: 0, podeEditar: true, criadoEm: new Date().toISOString() },
    'PATCH /posts/t': { id: 't' },
  });
  render(<EditarPost id="t" />);
  const campo = (await screen.findByLabelText('Texto')) as HTMLTextAreaElement;
  expect(campo.value).toBe('oi');
  expect(screen.queryByText('Legenda')).toBeNull();
  const salvar = screen.getByRole('button', { name: 'Salvar alterações' }) as HTMLButtonElement;
  expect(salvar.disabled).toBe(true);
  fireEvent.change(campo, { target: { value: 'a'.repeat(501) } });
  expect(screen.getByText('501/500. Corte 1 caracteres.')).toBeTruthy();
  expect(salvar.disabled).toBe(true);
  fireEvent.change(campo, { target: { value: '  novo texto  ' } });
  fireEvent.click(salvar);
  await waitFor(() => expect(chamadas.map((c) => c.chave)).toContain('PATCH /posts/t'));
  expect(JSON.parse(String(chamadas.find((c) => c.chave === 'PATCH /posts/t')!.body))).toEqual({ texto: 'novo texto' });
});
