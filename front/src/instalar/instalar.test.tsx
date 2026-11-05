import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type { Me } from '../api/cliente';
import { navegar } from '../rotas';
import { fetchFalso } from '../testes/fetchFalso';
import { proximaTela, VISTO } from './fluxo';
import { App } from '../App';
import { Perfil } from '../conta/Perfil';
import { TrocarSenha } from '../conta/TrocarSenha';
import { Instalar } from './Instalar';
import { ativarPush, cancelarInscricaoAoSair, desativarPush, reinscreverSePreciso } from './push';
import { capturarEntrada, guardarVolta, lerVolta } from './volta';

const me: Me = { id: 'u1', nome: 'Lincoln', email: 'l@x.com', avatarUrl: null, isAdmin: false, pushEnabled: false, clube: null };
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36';
const DESKTOP = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

const assinatura = { endpoint: 'https://fcm.googleapis.com/fcm/send/abc', toJSON: () => ({ endpoint: 'https://fcm.googleapis.com/fcm/send/abc', keys: { p256dh: 'P256', auth: 'AUT' } }), unsubscribe: vi.fn(async () => true) };

// ambiente do aparelho: userAgent, navigator.standalone, permissão e service worker
function aparelho({ semRegistro = false, ua = DESKTOP, standalone = false, permissao = 'default' as NotificationPermission, resposta = 'granted' as NotificationPermission, push = true, existente = null as typeof assinatura | null } = {}) {
  vi.stubGlobal('navigator', { userAgent: ua, platform: 'x', maxTouchPoints: 0, standalone, ...(push && { serviceWorker: { ready: Promise.resolve(registro), getRegistration: vi.fn(async () => (semRegistro ? undefined : registro)) } }) });
  const Notif: ReturnType<typeof vi.fn> & { permission: NotificationPermission; requestPermission: ReturnType<typeof vi.fn> } = Object.assign(vi.fn(), {
    permission: permissao,
    requestPermission: vi.fn(async () => {
      Notif.permission = resposta; // como no navegador: a resposta vira a permissão
      return resposta;
    }),
  });
  if (push) {
    vi.stubGlobal('Notification', Notif);
    vi.stubGlobal('PushManager', class {});
  } else {
    vi.stubGlobal('Notification', undefined);
    vi.stubGlobal('PushManager', undefined);
    delete (window as unknown as Record<string, unknown>).PushManager;
    delete (window as unknown as Record<string, unknown>).Notification;
  }
  registro.pushManager.getSubscription = vi.fn(async () => existente);
  return Notif;
}
const registro = {
  pushManager: {
    getSubscription: vi.fn(async (): Promise<typeof assinatura | null> => null),
    subscribe: vi.fn(async () => assinatura),
  },
};

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  registro.pushManager.subscribe.mockClear();
  assinatura.unsubscribe.mockClear();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  history.replaceState(null, '', '/');
});
const clica = (nome: string | RegExp) => fireEvent.click(screen.getByRole('button', { name: nome }));
const rotasPush = { 'GET /push/chave': { chave: 'BPXY-abc_123' }, 'POST /push/inscricao': { status: 204 }, 'PATCH /me': { ...me, pushEnabled: true } };

test('iPhone fora da tela inicial (standalone false) → passo a passo de instalar e NÃO pede permissão', () => {
  const Notif = aparelho({ ua: IPHONE, standalone: false });
  const chamadas = fetchFalso({});
  render(<Instalar caminho="/instalar" recarregar={() => {}} />);
  expect(screen.getByRole('heading', { name: 'Instale o InstaManager' })).toBeTruthy();
  const passos = screen.getAllByRole('listitem').map((li) => li.textContent);
  expect(passos).toHaveLength(3);
  expect(passos[0]).toContain('Compartilhar');
  expect(passos[1]).toContain('Adicionar à Tela de Início');
  expect(passos[2]).toContain('Adicionar');
  expect(Notif.requestPermission).not.toHaveBeenCalled();
  expect(chamadas).toHaveLength(0);
});

test('iPhone sem instalar em /avisos → "só funcionam com o app instalado", sem botão de ativar e sem pedir permissão', () => {
  const Notif = aparelho({ ua: IPHONE, standalone: false });
  fetchFalso({});
  render(<Instalar caminho="/avisos" recarregar={() => {}} />);
  expect(screen.getByText('No iPhone, os avisos só funcionam com o app instalado.')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Ativar avisos' })).toBeNull();
  clica('Ver como instalar');
  expect(location.pathname).toBe('/instalar');
  expect(Notif.requestPermission).not.toHaveBeenCalled();
});

test('instalado → explica antes; "Ativar avisos" pede a permissão, assina com a chave do servidor e envia a inscrição', async () => {
  const Notif = aparelho({ ua: IPHONE, standalone: true });
  const chamadas = fetchFalso(rotasPush);
  const recarregar = vi.fn();
  render(<Instalar caminho="/avisos" recarregar={recarregar} />);
  expect(screen.getByRole('heading', { name: 'Quer saber quando sai post?' })).toBeTruthy();
  expect(Notif.requestPermission).not.toHaveBeenCalled(); // só o toque pede
  clica('Ativar avisos');
  expect(await screen.findByRole('heading', { name: 'Avisos ativados' })).toBeTruthy();
  expect(Notif.requestPermission).toHaveBeenCalledOnce();
  const opcoes = registro.pushManager.subscribe.mock.calls[0] as unknown as [{ userVisibleOnly: boolean; applicationServerKey: Uint8Array }];
  expect(opcoes[0].userVisibleOnly).toBe(true);
  expect(opcoes[0].applicationServerKey).toBeInstanceOf(Uint8Array); // base64url da chave decodificado
  const post = chamadas.find((c) => c.chave === 'POST /push/inscricao')!;
  expect(JSON.parse(post.body as string)).toEqual({ endpoint: assinatura.endpoint, keys: { p256dh: 'P256', auth: 'AUT' } });
  expect(JSON.parse(chamadas.find((c) => c.chave === 'PATCH /me')!.body as string)).toEqual({ pushEnabled: true });
  expect(localStorage.getItem(VISTO)).toBe('1');
  expect(recarregar).toHaveBeenCalled();
});

test('permissão negada → como liberar nos ajustes, sem buscar chave nem assinar', async () => {
  aparelho({ standalone: true, resposta: 'denied' });
  const chamadas = fetchFalso({});
  render(<Instalar caminho="/avisos" recarregar={() => {}} />);
  clica('Ativar avisos');
  expect(await screen.findByRole('heading', { name: 'Avisos bloqueados' })).toBeTruthy();
  expect(screen.getByText(/Ajustes → Notificações → InstaManager → Permitir notificações/)).toBeTruthy();
  expect(screen.getByText(/Configurações do site → Notificações → Permitir/)).toBeTruthy();
  expect(chamadas).toHaveLength(0);
  expect(registro.pushManager.subscribe).not.toHaveBeenCalled();
});

test('já negada ao abrir: mostra o bloqueio e "Já liberei, tentar de novo" relê a permissão', async () => {
  const Notif = aparelho({ standalone: true, permissao: 'denied' });
  fetchFalso(rotasPush);
  render(<Instalar caminho="/avisos" recarregar={() => {}} />);
  expect(screen.getByRole('heading', { name: 'Avisos bloqueados' })).toBeTruthy();
  (Notif as unknown as { permission: string }).permission = 'default';
  clica('Já liberei, tentar de novo');
  expect(await screen.findByRole('heading', { name: 'Quer saber quando sai post?' })).toBeTruthy();
});

test('falha de rede ao ativar → "Não deu para ativar. Tente de novo." e o botão continua', async () => {
  aparelho({ standalone: true });
  fetchFalso({ 'GET /push/chave': { status: 500, corpo: {} } });
  render(<Instalar caminho="/avisos" recarregar={() => {}} />);
  clica('Ativar avisos');
  expect((await screen.findByRole('alert')).textContent).toContain('Não deu para ativar. Tente de novo.');
  expect(screen.getByRole('button', { name: 'Ativar avisos' })).toBeTruthy();
});

test('sem suporte a push → texto próprio e só "Continuar"', () => {
  aparelho({ standalone: true, push: false });
  fetchFalso({});
  render(<Instalar caminho="/avisos" recarregar={() => {}} />);
  expect(screen.getByText('Este aparelho não recebe avisos do navegador. Você usa o app normalmente.')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Ativar avisos' })).toBeNull();
  clica('Continuar');
  expect(location.pathname).toBe('/');
});

test('"Agora não" guarda a escolha e vai ao feed', () => {
  aparelho({ standalone: true });
  fetchFalso({});
  history.replaceState(null, '', '/avisos');
  render(<Instalar caminho="/avisos" recarregar={() => {}} />);
  clica('Agora não');
  expect(localStorage.getItem(VISTO)).toBe('1');
  expect(location.pathname).toBe('/');
});

test('Android: botão Instalar app usa o evento beforeinstallprompt; desktop mostra o texto curto', async () => {
  aparelho({ ua: ANDROID });
  fetchFalso({});
  const prompt = vi.fn(async () => undefined);
  const ev = Object.assign(new Event('beforeinstallprompt'), { prompt, userChoice: Promise.resolve({ outcome: 'accepted' }) });
  window.dispatchEvent(ev);
  render(<Instalar caminho="/instalar" recarregar={() => {}} />);
  clica('Instalar app');
  await waitFor(() => expect(prompt).toHaveBeenCalled());
  cleanup();

  aparelho({ ua: DESKTOP });
  render(<Instalar caminho="/instalar" recarregar={() => {}} />);
  expect(screen.getByText('Dá para usar pelo navegador mesmo.')).toBeTruthy();
  clica('Continuar');
  expect(location.pathname).toBe('/avisos');
});

test('ativarPush(): sem-suporte / negado / ok', async () => {
  aparelho({ push: false });
  expect(await ativarPush()).toBe('sem-suporte');
  aparelho({ resposta: 'denied' });
  fetchFalso({});
  expect(await ativarPush()).toBe('negado');
  aparelho({ permissao: 'granted', existente: assinatura });
  fetchFalso(rotasPush);
  expect(await ativarPush()).toBe('ok');
  expect(registro.pushManager.subscribe).not.toHaveBeenCalled(); // reaproveita a inscrição do aparelho
});

test('desligar no perfil → DELETE inscrição + cancela no aparelho + PATCH /me pushEnabled false', async () => {
  aparelho({ permissao: 'granted', existente: assinatura });
  const chamadas = fetchFalso({ 'DELETE /push/inscricao': { status: 204 }, 'PATCH /me': { ...me, pushEnabled: false } });
  await desativarPush();
  expect(chamadas.map((c) => c.chave)).toEqual(['DELETE /push/inscricao', 'PATCH /me']);
  expect(JSON.parse(chamadas[0].body as string)).toEqual({ endpoint: assinatura.endpoint });
  expect(JSON.parse(chamadas[1].body as string)).toEqual({ pushEnabled: false });
  expect(assinatura.unsubscribe).toHaveBeenCalled();
});

test('desligar sem inscrição no aparelho só muda o pushEnabled', async () => {
  aparelho({ permissao: 'granted', existente: null });
  const chamadas = fetchFalso({ 'PATCH /me': { ...me, pushEnabled: false } });
  await desativarPush();
  expect(chamadas.map((c) => c.chave)).toEqual(['PATCH /me']);
});

test('proximaTela: só na primeira vez; instalado → /avisos; iPhone/Android/desktop → /instalar; já permitida → nada', () => {
  aparelho({ ua: IPHONE, standalone: true });
  expect(proximaTela()).toBe('/avisos');
  aparelho({ ua: IPHONE, standalone: false });
  expect(proximaTela()).toBe('/instalar');
  aparelho({ ua: ANDROID });
  expect(proximaTela()).toBe('/instalar');
  aparelho({ ua: DESKTOP });
  expect(proximaTela()).toBe('/instalar');
  aparelho({ ua: DESKTOP, permissao: 'granted' });
  expect(proximaTela()).toBeNull();
  aparelho({ ua: IPHONE, standalone: true });
  localStorage.setItem(VISTO, '1');
  expect(proximaTela()).toBeNull();
});

test('volta: guarda a rota privada, devolve uma vez e recusa rota de acesso, URL externa e lixo', () => {
  guardarVolta('/p/abc?x=1');
  expect(lerVolta()).toBe('/p/abc?x=1');
  expect(lerVolta()).toBeNull();
  for (const ruim of ['/entrar', '/cadastro', '/esqueci-senha', '/nova-senha', '//evil.test/x', 'https://evil.test', 'p/abc', '/\\evil.test', '/']) {
    guardarVolta(ruim);
    expect(lerVolta()).toBeNull();
  }
});

test('sem service worker registrado (dev) → sem-suporte, sem travar esperando o "ready"', async () => {
  aparelho({ permissao: 'granted', semRegistro: true });
  fetchFalso({ 'GET /push/chave': { chave: 'BPXY-abc_123' } });
  expect(await ativarPush()).toBe('sem-suporte');
});

test('depois de trocar a senha: reinscreve este aparelho se o push estava ativo e a permissão vale', async () => {
  aparelho({ permissao: 'granted', existente: assinatura });
  const chamadas = fetchFalso(rotasPush);
  await reinscreverSePreciso(true);
  expect(chamadas.map((c) => c.chave)).toEqual(['GET /push/chave', 'POST /push/inscricao', 'PATCH /me']);
  chamadas.length = 0;
  await reinscreverSePreciso(false); // estava desligado: nada
  expect(chamadas).toHaveLength(0);
  aparelho({ permissao: 'denied' });
  await reinscreverSePreciso(true); // permissão perdida: nada (e não pede de novo)
  expect(chamadas).toHaveLength(0);
});

test('reinscrever com a rede fora não lança (a troca de senha já deu certo)', async () => {
  aparelho({ permissao: 'granted', existente: assinatura });
  fetchFalso({ 'GET /push/chave': { status: 500, corpo: {} } });
  await expect(reinscreverSePreciso(true)).resolves.toBeUndefined();
});

test('TrocarSenha: sucesso → o aparelho se reinscreve no push (só depois do PATCH da senha)', async () => {
  aparelho({ permissao: 'granted', existente: assinatura });
  const chamadas = fetchFalso({ ...rotasPush, 'PATCH /me': { ...me, pushEnabled: true } });
  render(<TrocarSenha pushEnabled />);
  fireEvent.change(screen.getByLabelText('Senha atual'), { target: { value: 'velha-senha-1' } });
  fireEvent.change(screen.getByLabelText('Nova senha'), { target: { value: 'nova-senha-123' } });
  clica('Salvar senha');
  expect(await screen.findByRole('heading', { name: 'Senha trocada' })).toBeTruthy();
  const ordem = chamadas.map((c) => c.chave);
  expect(ordem.indexOf('PATCH /me')).toBe(0);
  expect(ordem).toContain('POST /push/inscricao');
});

test('TrocarSenha: push desligado antes → não mexe no push; senha atual errada → também não', async () => {
  aparelho({ permissao: 'granted', existente: assinatura });
  const chamadas = fetchFalso({ 'PATCH /me': { ...me } });
  render(<TrocarSenha pushEnabled={false} />);
  fireEvent.change(screen.getByLabelText('Senha atual'), { target: { value: 'velha-senha-1' } });
  fireEvent.change(screen.getByLabelText('Nova senha'), { target: { value: 'nova-senha-123' } });
  clica('Salvar senha');
  await screen.findByRole('heading', { name: 'Senha trocada' });
  expect(chamadas.map((c) => c.chave)).toEqual(['PATCH /me']);
  cleanup();

  aparelho({ permissao: 'granted', existente: assinatura });
  const c2 = fetchFalso({ 'PATCH /me': { status: 400, corpo: { codigo: 'SENHA_ATUAL_INVALIDA', mensagem: 'x' } } });
  render(<TrocarSenha pushEnabled />);
  fireEvent.change(screen.getByLabelText('Senha atual'), { target: { value: 'errada-errada' } });
  fireEvent.change(screen.getByLabelText('Nova senha'), { target: { value: 'nova-senha-123' } });
  clica('Salvar senha');
  await screen.findByText('Senha atual incorreta.');
  expect(c2.map((c) => c.chave)).toEqual(['PATCH /me']);
});

const clubesNada = { 'GET /trocas/minhas': [] };
test('Perfil: interruptor desligado → liga de verdade (permissão, inscrição e pushEnabled) e fica ligado', async () => {
  aparelho({ standalone: true, resposta: 'granted' });
  const chamadas = fetchFalso({ ...clubesNada, ...rotasPush });
  render(<Perfil me={me} recarregar={() => {}} />);
  const chave = screen.getByRole('switch', { name: 'Notificações' });
  expect(chave.getAttribute('aria-checked')).toBe('false');
  fireEvent.click(chave);
  expect(chave.getAttribute('aria-checked')).toBe('true'); // otimista enquanto responde
  await waitFor(() => expect(chamadas.map((c) => c.chave)).toContain('POST /push/inscricao'));
  expect(JSON.parse(chamadas.find((c) => c.chave === 'PATCH /me')!.body as string)).toEqual({ pushEnabled: true });
  await waitFor(() => expect((chave as HTMLButtonElement).disabled).toBe(false));
  expect(chave.getAttribute('aria-checked')).toBe('true');
});

test('Perfil: interruptor ligado → desliga (DELETE inscrição + pushEnabled false)', async () => {
  aparelho({ standalone: true, permissao: 'granted', existente: assinatura });
  const chamadas = fetchFalso({ ...clubesNada, 'DELETE /push/inscricao': { status: 204 }, 'PATCH /me': { ...me, pushEnabled: false } });
  render(<Perfil me={{ ...me, pushEnabled: true }} recarregar={() => {}} />);
  const chave = screen.getByRole('switch', { name: 'Notificações' });
  expect(chave.getAttribute('aria-checked')).toBe('true');
  fireEvent.click(chave);
  await waitFor(() => expect(chamadas.map((c) => c.chave)).toEqual(expect.arrayContaining(['DELETE /push/inscricao', 'PATCH /me'])));
  await waitFor(() => expect(chave.getAttribute('aria-checked')).toBe('false'));
});

test('Perfil: falha de rede ao ligar → volta desligado e avisa', async () => {
  aparelho({ standalone: true, resposta: 'granted' });
  fetchFalso({ ...clubesNada, 'GET /push/chave': { status: 500, corpo: {} } });
  render(<Perfil me={me} recarregar={() => {}} />);
  const chave = screen.getByRole('switch', { name: 'Notificações' });
  fireEvent.click(chave);
  await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Não deu para ativar. Tente de novo.'));
  expect(chave.getAttribute('aria-checked')).toBe('false');
});

test('Perfil: bloqueado no aparelho ou iPhone sem instalar → interruptor desligado, motivo em âmbar e o toque abre /avisos', async () => {
  aparelho({ permissao: 'denied', standalone: true });
  fetchFalso(clubesNada);
  render(<Perfil me={{ ...me, pushEnabled: true }} recarregar={() => {}} />);
  expect(screen.getByRole('switch', { name: 'Notificações' }).getAttribute('aria-checked')).toBe('false');
  expect(screen.getByText('Bloqueado neste aparelho. Toque para ver como liberar.')).toBeTruthy();
  fireEvent.click(screen.getByRole('switch', { name: 'Notificações' }));
  expect(location.pathname).toBe('/avisos');
  cleanup();

  history.replaceState(null, '', '/perfil');
  aparelho({ ua: IPHONE, standalone: false });
  fetchFalso(clubesNada);
  render(<Perfil me={me} recarregar={() => {}} />);
  expect(screen.getByText('No iPhone, instale o app para receber avisos.')).toBeTruthy();
  fireEvent.click(screen.getByRole('switch', { name: 'Notificações' }));
  expect(location.pathname).toBe('/avisos');
});

test('Sair: DELETE da inscrição ANTES do POST /auth/sair', async () => {
  aparelho({ permissao: 'granted', existente: assinatura });
  const chamadas = fetchFalso({ 'GET /trocas/minhas': [], 'DELETE /push/inscricao': { status: 204 }, 'POST /auth/sair': { status: 204 } });
  render(<Perfil me={{ ...me, pushEnabled: true }} recarregar={() => {}} />);
  clica('Sair da conta');
  await waitFor(() => expect(chamadas.map((c) => c.chave).filter((k) => !k.startsWith('GET '))).toEqual(['DELETE /push/inscricao', 'POST /auth/sair']));
  expect(JSON.parse(chamadas.find((c) => c.chave === 'DELETE /push/inscricao')!.body as string)).toEqual({ endpoint: assinatura.endpoint });
  expect(assinatura.unsubscribe).toHaveBeenCalled();
});

test('Sair nunca trava: falha ao cancelar o push não impede o POST /auth/sair', async () => {
  aparelho({ permissao: 'granted', existente: assinatura });
  const chamadas = fetchFalso({ 'GET /trocas/minhas': [], 'DELETE /push/inscricao': { status: 500, corpo: {} }, 'POST /auth/sair': { status: 204 } });
  await cancelarInscricaoAoSair();
  render(<Perfil me={{ ...me, pushEnabled: true }} recarregar={() => {}} />);
  clica('Sair da conta');
  await waitFor(() => expect(chamadas.map((c) => c.chave)).toContain('POST /auth/sair'));
});

const aoVivo = (logado: { v: boolean }) => ({
  'GET /me': () => (logado.v ? me : { status: 401, corpo: { codigo: 'NAO_AUTENTICADO', mensagem: 'x' } }),
  'POST /auth/entrar': () => ((logado.v = true), me),
  'GET /posts/abc': { status: 404, corpo: { codigo: 'NAO_ENCONTRADO', mensagem: 'x' } },
  'GET /posts': { itens: [], proximo: null },
});
const entrar = async () => {
  fireEvent.change(await screen.findByLabelText('E-mail'), { target: { value: 'l@x.com' } });
  fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'senha-boa-123' } });
  fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));
};

test('link de push aberto deslogado → depois do login volta para a rota original (e não para a tela de instalar)', async () => {
  aparelho({ ua: DESKTOP });
  fetchFalso(aoVivo({ v: false }));
  history.replaceState(null, '', '/p/abc?de=push');
  capturarEntrada(); // o que o app faz ao carregar
  render(<App />);
  await entrar();
  await waitFor(() => expect(location.pathname + location.search).toBe('/p/abc?de=push'));
  expect(sessionStorage.getItem('im:volta')).toBeNull(); // uma vez só
});

test('link de push → /cadastro → login: a rota original sobrevive ao passeio pelas telas de acesso', async () => {
  aparelho({ ua: DESKTOP });
  fetchFalso(aoVivo({ v: false }));
  history.replaceState(null, '', '/p/abc');
  capturarEntrada();
  render(<App />);
  fireEvent.click(await screen.findByRole('link', { name: 'Criar conta com convite' }));
  await waitFor(() => expect(location.pathname).toBe('/cadastro'));
  act(() => navegar('/entrar'));
  await entrar();
  await waitFor(() => expect(location.pathname).toBe('/p/abc'));
});

test('primeira vez logada no feed → /instalar; depois de "Agora não" fica no feed', async () => {
  aparelho({ ua: DESKTOP });
  fetchFalso(aoVivo({ v: true }));
  history.replaceState(null, '', '/');
  render(<App />);
  await waitFor(() => expect(location.pathname).toBe('/instalar'));
  clica('Continuar'); // desktop → /avisos
  await waitFor(() => expect(location.pathname).toBe('/avisos'));
  clica('Agora não');
  await waitFor(() => expect(location.pathname).toBe('/'));
  cleanup();
  render(<App />);
  await screen.findByRole('navigation', { name: 'Principal' });
  expect(location.pathname).toBe('/'); // já visto: não volta a aparecer
});

test('mostrou = visto: abrir /instalar já marca, e sair pela barra abre o feed (não volta para /instalar)', async () => {
  aparelho({ ua: DESKTOP });
  fetchFalso(aoVivo({ v: true }));
  history.replaceState(null, '', '/');
  render(<App />);
  await waitFor(() => expect(location.pathname).toBe('/instalar'));
  expect(localStorage.getItem(VISTO)).toBe('1'); // marcado ao montar, sem tocar em nada
  fireEvent.click(screen.getByRole('link', { name: 'Feed' })); // barra inferior
  await waitFor(() => expect(location.pathname).toBe('/'));
  await new Promise((r) => setTimeout(r, 50));
  expect(location.pathname).toBe('/');
});

test('cancelarInscricaoAoSair espera no máximo ~3 s mesmo com o servidor pendurado', async () => {
  vi.useFakeTimers();
  try {
    aparelho({ permissao: 'granted', existente: assinatura });
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => undefined))); // DELETE nunca responde
    let acabou = false;
    const p = cancelarInscricaoAoSair().then(() => (acabou = true));
    await vi.advanceTimersByTimeAsync(2900);
    expect(acabou).toBe(false);
    await vi.advanceTimersByTimeAsync(200);
    await p;
    expect(acabou).toBe(true);
  } finally {
    vi.useRealTimers();
  }
});

test('Sair com push pendurado: o POST /auth/sair sai depois do limite, sem travar para sempre', async () => {
  vi.useFakeTimers();
  try {
    aparelho({ permissao: 'granted', existente: assinatura });
    const chamadas: string[] = [];
    vi.stubGlobal('fetch', vi.fn((url: string, init?: RequestInit) => {
      chamadas.push(`${init?.method ?? 'GET'} ${url.replace(/^\/api/, '')}`);
      return url.endsWith('/auth/sair') ? Promise.resolve(new Response(null, { status: 204 })) : new Promise(() => undefined);
    }));
    render(<Perfil me={{ ...me, pushEnabled: true }} recarregar={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Sair da conta' }));
    await vi.advanceTimersByTimeAsync(3100);
    expect(chamadas.filter((k) => !k.startsWith('GET '))).toEqual(['DELETE /push/inscricao', 'POST /auth/sair']);
  } finally {
    vi.useRealTimers();
  }
});
