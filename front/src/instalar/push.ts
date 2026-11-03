import { api, type Me } from '../api/cliente';

export type ResultadoPush = 'ok' | 'negado' | 'sem-suporte';

export const suportaPush = () =>
  typeof Notification !== 'undefined' && typeof PushManager !== 'undefined' && 'serviceWorker' in navigator;

// `serviceWorker.ready` nunca resolve se não há SW registrado (em dev ele só é registrado no build): sem registro, não há push
async function registroPush() {
  if (!(await navigator.serviceWorker.getRegistration())) return null;
  return navigator.serviceWorker.ready;
}

// a chave VAPID vem em base64url; o pushManager quer bytes
function chaveParaBytes(b64: string) {
  const bin = atob((b64 + '='.repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

/**
 * Pede a permissão, assina o push com a chave do servidor e registra a inscrição. Chamar direto de um toque:
 * o iOS só mostra o pedido de permissão com gesto do usuário, por isso requestPermission é a primeira coisa que roda.
 * Erro de rede lança (a tela mostra "Tente de novo").
 */
export async function ativarPush(): Promise<ResultadoPush> {
  if (!suportaPush()) return 'sem-suporte';
  const permissao = Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission;
  if (permissao !== 'granted') return 'negado';
  const registro = await registroPush();
  if (!registro) return 'sem-suporte';
  const { chave } = await api<{ chave: string }>('/push/chave');
  // reaproveita a inscrição do aparelho, se já houver
  const assinatura = (await registro.pushManager.getSubscription()) ?? (await registro.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chaveParaBytes(chave) as BufferSource }));
  const { endpoint, keys } = assinatura.toJSON();
  await api('/push/inscricao', { method: 'POST', body: JSON.stringify({ endpoint, keys: { p256dh: keys?.p256dh, auth: keys?.auth } }) });
  await api<Me>('/me', { method: 'PATCH', body: JSON.stringify({ pushEnabled: true }) });
  return 'ok';
}

/** Desliga: apaga a inscrição deste aparelho no servidor e nele, e marca pushEnabled false. */
export async function desativarPush(): Promise<void> {
  if (suportaPush()) {
    const assinatura = await (await registroPush())?.pushManager.getSubscription();
    if (assinatura) {
      await api('/push/inscricao', { method: 'DELETE', body: JSON.stringify({ endpoint: assinatura.endpoint }) });
      await assinatura.unsubscribe();
    }
  }
  await api<Me>('/me', { method: 'PATCH', body: JSON.stringify({ pushEnabled: false }) });
}

export type EstadoPush = 'ligado' | 'desligado' | 'negado' | 'ios-sem-instalar' | 'sem-suporte';
/** Para o interruptor do Perfil (perfis.md): o que mostrar e, se não dá para ligar, por quê. */
export function estadoPush(pushEnabled: boolean, ios: boolean, instalado: boolean): EstadoPush {
  if (ios && !instalado) return 'ios-sem-instalar';
  if (!suportaPush()) return 'sem-suporte';
  if (Notification.permission === 'denied') return 'negado';
  return pushEnabled && Notification.permission === 'granted' ? 'ligado' : 'desligado';
}

/**
 * Depois de trocar a senha o servidor apaga TODAS as inscrições de push da conta (inclusive a deste aparelho).
 * Se o push estava ativo e a permissão continua valendo, assina de novo. Rede fora não estraga a troca de senha.
 */
export async function reinscreverSePreciso(pushEnabledAntes: boolean): Promise<void> {
  if (!pushEnabledAntes || !suportaPush() || Notification.permission !== 'granted') return;
  try {
    await ativarPush();
  } catch {
    // sem rede agora: o interruptor do Perfil mostra desligado e a pessoa liga de novo
  }
}

const LIMITE_SAIR_MS = 3000;

/**
 * Antes de sair: tira este aparelho do push (senão ele segue recebendo avisos de quem saiu).
 * Nunca impede o logout: erro é engolido e, com a rede pendurada, espera no máximo ~3 s.
 */
export async function cancelarInscricaoAoSair(): Promise<void> {
  const cancelar = async () => {
    if (!suportaPush()) return;
    const assinatura = await (await registroPush())?.pushManager.getSubscription();
    if (!assinatura) return;
    await api('/push/inscricao', { method: 'DELETE', body: JSON.stringify({ endpoint: assinatura.endpoint }) });
    await assinatura.unsubscribe();
  };
  let relogio: ReturnType<typeof setTimeout> | undefined;
  const limite = new Promise<void>((ok) => (relogio = setTimeout(ok, LIMITE_SAIR_MS)));
  // se o servidor demorar, a inscrição velha o próprio servidor apaga quando o push voltar 404/410
  await Promise.race([cancelar().catch(() => undefined), limite]);
  clearTimeout(relogio);
}
