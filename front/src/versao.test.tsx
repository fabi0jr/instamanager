import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { AvisoVersao } from './AvisoVersao';

const meta = (v?: string) => {
  document.head.querySelectorAll('meta[name=versao]').forEach((m) => m.remove());
  if (v) document.head.insertAdjacentHTML('beforeend', `<meta name="versao" content="${v}">`);
};
const servidor = (v: string | (() => never)) =>
  vi.fn(async () => {
    if (typeof v === 'function') v();
    return new Response(JSON.stringify({ versao: v }));
  });
const voltar = () => act(() => { document.dispatchEvent(new Event('visibilitychange')); });

beforeEach(() => meta('aaa'));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); meta(); });

test('versão igual: nenhuma faixa', async () => {
  const f = servidor('aaa');
  vi.stubGlobal('fetch', f);
  render(<AvisoVersao />);
  await waitFor(() => expect(f).toHaveBeenCalledWith('/version.json', expect.objectContaining({ cache: 'no-store' })));
  expect(screen.queryByText('Nova versão do InstaManager')).toBeNull();
});

test('versão nova ao abrir mostra a faixa e Atualizar recarrega', async () => {
  vi.stubGlobal('fetch', servidor('bbb'));
  const reload = vi.fn();
  vi.stubGlobal('location', { ...window.location, reload });
  render(<AvisoVersao />);
  expect(await screen.findByText('Nova versão do InstaManager')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Atualizar' }));
  expect(reload).toHaveBeenCalled();
});

test('confere de novo ao voltar ao primeiro plano', async () => {
  let v = 'aaa';
  const f = vi.fn(async () => new Response(JSON.stringify({ versao: v })));
  vi.stubGlobal('fetch', f);
  render(<AvisoVersao />);
  await waitFor(() => expect(f).toHaveBeenCalledTimes(1));
  v = 'ccc';
  voltar();
  expect(await screen.findByText('Nova versão do InstaManager')).toBeTruthy();
});

test('sem rede, sem meta (dev) ou resposta estranha: silêncio', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
  render(<AvisoVersao />);
  await act(async () => {});
  expect(screen.queryByText('Nova versão do InstaManager')).toBeNull();
  cleanup();
  meta();
  const f = servidor('zzz');
  vi.stubGlobal('fetch', f);
  render(<AvisoVersao />);
  await act(async () => {});
  expect(f).not.toHaveBeenCalled();
});
