import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type { Me } from '../api/cliente';
import { _zerarErros } from '../erros';
import { Postar } from './Postar';

const clube = { id: 'palmeiras', nome: 'Palmeiras', escudoUrl: '/escudos/palmeiras.svg' };
const tecnico: Me = { id: 'u1', nome: 'Lincoln', email: 'l@x.com', avatarUrl: null, isAdmin: false, pushEnabled: false, clube };
const admin: Me = { ...tecnico, isAdmin: true };

let envios: FormData[] = [];
let respostas: { status: number; corpo: string }[] = [];
class FakeXhr {
  upload = {};
  status = 0;
  responseText = '';
  onload?: () => void;
  open = vi.fn();
  send(form: FormData) {
    envios.push(form);
    const r = respostas.shift() ?? { status: 201, corpo: '{"id":"novo"}' };
    queueMicrotask(() => { this.status = r.status; this.responseText = r.corpo; this.onload?.(); });
  }
}
let erros: string[] = [];
beforeEach(() => {
  envios = [];
  respostas = [];
  erros = [];
  _zerarErros();
  localStorage.setItem('im:postar-modo', 'texto');
  vi.stubGlobal('XMLHttpRequest', FakeXhr);
  vi.stubGlobal('fetch', vi.fn(async (u: string, init: RequestInit) => { if (u === '/api/erros-front') erros.push(JSON.parse(init.body as string).mensagem); return new Response(null, { status: 204 }); }));
  history.pushState(null, '', '/postar');
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); localStorage.clear(); });

const escrever = () => fireEvent.change(screen.getByPlaceholderText('O que está rolando?'), { target: { value: 'Bora' } });

test('admin vê "Postar como CBF" e não-admin não', () => {
  render(<Postar me={admin} />);
  expect(screen.getByRole('switch', { name: 'Postar como CBF' })).toBeTruthy();
  cleanup();
  render(<Postar me={tecnico} />);
  expect(screen.queryByRole('switch', { name: 'Postar como CBF' })).toBeNull();
});

test('ligado: frase, botão "Publicar como CBF" e comoCbf=true no envio; desligado por padrão', async () => {
  render(<Postar me={admin} />);
  expect((screen.getByRole('switch', { name: 'Postar como CBF' })).getAttribute('aria-checked')).toBe('false');
  expect(screen.getByText('Vai sair como Palmeiras, por Lincoln.')).toBeTruthy();
  fireEvent.click(screen.getByRole('switch', { name: 'Postar como CBF' }));
  expect(screen.getByText('Vai sair como CBF, perfil oficial.')).toBeTruthy();
  escrever();
  fireEvent.click(screen.getByRole('button', { name: 'Publicar como CBF' }));
  await waitFor(() => expect(envios).toHaveLength(1));
  expect(envios[0].get('comoCbf')).toBe('true');
});

test('403 NAO_E_ADMIN: avisa e o botão vira "Publicar pelo meu clube", que envia sem comoCbf', async () => {
  respostas = [{ status: 403, corpo: '{"codigo":"NAO_E_ADMIN"}' }];
  render(<Postar me={admin} />);
  fireEvent.click(screen.getByRole('switch', { name: 'Postar como CBF' }));
  escrever();
  fireEvent.click(screen.getByRole('button', { name: 'Publicar como CBF' }));
  expect(await screen.findByText(/Só o admin pode postar como CBF\. Seu acesso mudou/)).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Publicar pelo meu clube' }));
  await waitFor(() => expect(envios).toHaveLength(2));
  expect(envios[1].get('comoCbf')).toBeNull();
});

test('falha de envio de post registra o erro', async () => {
  respostas = [{ status: 500, corpo: '{"codigo":"ERRO_INTERNO"}' }];
  render(<Postar me={tecnico} />);
  escrever();
  fireEvent.click(screen.getByRole('button', { name: 'Publicar' }));
  await waitFor(() => expect(erros).toEqual(['falha ao publicar post: ERRO_INTERNO']));
});
