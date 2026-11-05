import { request, type APIRequestContext, type FullConfig } from '@playwright/test';

const SENHA = 'senha-e2e-123';
const CONVITE = process.env.INVITE_CODE ?? 'CONVITE-CI';
export const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin-e2e@ci.test';
export const TECNICO_EMAIL = 'tecnico-e2e@ci.test';

async function entrar(api: APIRequestContext, email: string, nome: string, clubeId: string | null) {
  const cad = await api.post('/api/auth/cadastro', { data: { convite: CONVITE, email, senha: SENHA, nome, clubeId } });
  if (cad.status() === 409) { // já existe (execução repetida no mesmo banco): só entra
    const ent = await api.post('/api/auth/entrar', { data: { email, senha: SENHA } });
    if (!ent.ok()) throw new Error(`entrar ${email}: ${ent.status()} ${await ent.text()}`);
  } else if (!cad.ok()) throw new Error(`cadastro ${email}: ${cad.status()} ${await cad.text()}`);
}

// Cria o técnico (palmeiras) e o admin, deixa a rodada 1 com um jogo agendado e prazo de palpite, e guarda a sessão do técnico.
export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0].use.baseURL!;
  const admin = await request.newContext({ baseURL, extraHTTPHeaders: { Origin: new URL(baseURL).origin } });
  await entrar(admin, ADMIN_EMAIL, 'Admin E2E', null);
  const jogos = await admin.put('/api/admin/rodadas/1/jogos', { data: { jogos: [{ mandanteId: 'palmeiras', visitanteId: 'flamengo', golsMandante: null, golsVisitante: null }] } });
  if (!jogos.ok()) throw new Error(`jogos: ${jogos.status()} ${await jogos.text()}`);
  const prazo = await admin.put('/api/admin/rodadas/1/prazo', { data: { prazoPalpite: new Date(Date.now() + 7 * 86_400_000).toISOString() } });
  if (!prazo.ok()) throw new Error(`prazo: ${prazo.status()} ${await prazo.text()}`);
  await admin.dispose();

  const tecnico = await request.newContext({ baseURL, extraHTTPHeaders: { Origin: new URL(baseURL).origin } });
  await entrar(tecnico, TECNICO_EMAIL, 'Tecnico E2E', 'palmeiras');
  await tecnico.storageState({ path: '.auth/tecnico.json' });
  await tecnico.dispose();
}

export { SENHA };
