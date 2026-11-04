// Manda erros soltos do app para POST /api/erros-front. No máx. 5 por minuto (conta também os que falham) e sem `api()`:
// se o POST falhar, o erro é engolido em vez de disparar outro erro (sem loop).
const JANELA_MS = 60_000;
const MAXIMO = 5;
let envios: number[] = [];

const versao = () => document.querySelector<HTMLMetaElement>('meta[name=versao]')?.content ?? 'dev';

export function registrarErro(mensagem: string, pilha?: string) {
  const agora = Date.now();
  envios = envios.filter((t) => agora - t < JANELA_MS);
  if (envios.length >= MAXIMO) return;
  envios.push(agora);
  const corpo = { mensagem: mensagem || 'erro sem mensagem', url: location.pathname, versao: versao(), ...(pilha && { pilha }) };
  try {
    fetch('/api/erros-front', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) }).catch(() => {});
  } catch {
    /* fetch ausente ou quebrado: nada a fazer */
  }
}

export function instalarCapturaDeErros() {
  addEventListener('error', (e) => registrarErro(e.message, e.error?.stack));
  addEventListener('unhandledrejection', (e) => {
    const r = e.reason;
    registrarErro(r instanceof Error ? r.message : String(r), r instanceof Error ? r.stack : undefined);
  });
}

export const _zerarErros = () => (envios = []); // só para os testes
