# InstaManager v1 — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> Neste projeto a execução segue o **fluxo do Maestri** (`docs/fluxo.md`, copiado do Terrato). Cada tarefa vira um card no quadro (`node board/board.mjs`, prefixo `IM-`) e passa por dev → revisão → QA → merge do Maestro, com um andar (git worktree) por tarefa.

**Goal:** Entregar a v1 da spec: rede social estilo Instagram para a liga OSM, com feed, perfil do clube, galeria de prompts, push, trocas de time e admin, instalável como PWA e no ar na VPS.

**Architecture:** Monorepo pnpm com `front/` (React + Vite + TS, PWA com service worker escrito à mão) e `back/` (Nest + Prisma + Postgres 17), na mesma forma do Terrato. As imagens são comprimidas **no celular** em duas versões (cheia e miniatura), o back valida e grava no volume `uploads/`, e o nginx do container `web` serve `/uploads`. Sessão em cookie opaco. Auth, e-mail (Resend via `fetch`), roteador mínimo, CI e deploy são copiados e adaptados do Terrato.

**Tech Stack:** pnpm, React 19 + Vite 8 + Vitest (front); Nest 12 + Prisma 7 (`@prisma/adapter-pg`) + Vitest + supertest (back); Postgres 17; GitHub Actions; Docker + Traefik na VPS. Dependência nova: **`web-push`** (back), que depende do portão do Fabio.

**Spec:** `docs/superpowers/specs/2026-11-03-instamanager-design.md`

## Global Constraints

- Português do Brasil em toda a interface, e-mails e mensagens de erro.
- Clubes: os 20 da Série A 2026, em lista fixa no seed. **Um técnico por clube** (`Club.coachId @unique`), **um clube por pessoa** (pela mesma coluna única). Quem não tem clube é **torcedor**.
- Torcedor e ex-técnico **não postam**. Quem edita e apaga post é o **técnico atual do clube** ou o admin.
- Cadastro exige o código de convite (`Setting.inviteCode`; valor inicial vem de `INVITE_CODE` no `.env`). Não existe confirmação de e-mail. Admin = conta cujo e-mail é igual a `ADMIN_EMAIL` no `.env`.
- Login só com e-mail e senha. Recuperação de senha por e-mail via Resend, com link válido por **1 h** e uso único.
- Post: de **1 a 10 imagens**, legenda de até **2200** caracteres e prompt opcional por imagem de até **4000**. Comentário de até **1000** caracteres.
- Imagens geradas no cliente em **JPEG**: cheia com lado maior de **1600 px** e miniatura com **480 px**, qualidade **0.82**. O back recusa arquivo que não comece com a assinatura JPEG (`FF D8 FF`) ou que passe de **3 MB**.
- Push (Web Push/VAPID) em três casos: post novo (todos menos o autor), comentário em post do clube (técnico atual, se não for quem comentou) e troca de time (pedido → admin; decisão → técnico). Respeita `User.pushEnabled`.
- Sem stories, DM, tabela, prêmios, vídeo, busca ou @ (ficam para a v1.1). Nada é importado do WhatsApp.
- Dependência nova só com aprovação do Fabio. Já aprovadas pela spec: o mesmo conjunto do Terrato. **A aprovar: `web-push` + `@types/web-push`.**
- Segredos só em `.env`. Toda lógica nova vem com teste. Commits em Conventional Commits com o ID do card (`feat(posts): feed por cursor [IM-7]`).
- Desempenho: feed em páginas de **12** posts por cursor, miniaturas com `loading="lazy"` e nenhuma imagem cheia no feed.

**Ajuste de spec para o Fabio aprovar:** a §4.2 diz que "o servidor também gera uma versão menor". O plano gera as duas versões no celular, para não precisar de `sharp` (dependência nativa) no back. O resultado para o usuário é o mesmo.

## Review Focus

1. **Dois cadastros ao mesmo tempo escolhem o mesmo clube.** Um entra e o outro recebe `409 CLUBE_OCUPADO`, sem conta criada pela metade. Teste na Task 3.
2. **Troca aprovada para um clube que foi ocupado depois do pedido.** A aprovação falha com `409`, nada muda e o pedido continua pendente. Teste na Task 6.
3. **Foto enorme do iPhone, HEIC ou arquivo que não é imagem.** No cliente: comprime ou mostra "não consegui ler esta imagem". No back: `400 IMAGEM_INVALIDA` para quem burla o cliente. Testes nas Tasks 5 e 12.
4. **Inscrição de push vencida (404/410 do serviço de push).** A inscrição é apagada e o envio para os demais continua. Teste na Task 7.
5. **Ex-técnico editando post antigo ou torcedor postando.** Recebe `403`, e a interface nem mostra o botão. Testes nas Tasks 5 e 11.

---

## Trilhas (para o Maestri)

| Trilha | Dono de |
|---|---|
| Back | `back/**` |
| Front | `front/**` |
| Design | Penpot + `docs/design/**` (projeto já criado e aberto pelo Fabio) |
| Maestro/Infra | `board/**`, `docs/fluxo.md`, `.github/**`, `docker-compose*.yml` |

Ondas: **0** = Tasks 1, 2, D1 · **1** = D2, 3, 4 · **2** = 5, 6, 7, 8, 9 · **3** = 10–14 · **4** = 15, 16.
Tela de front só começa depois que o design dela for aprovado pelo Fabio (portão).

---

### Task 1: Fundação do repo, quadro e fluxo

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `docker-compose.yml` (Postgres de dev), `.env.example`, `README.md`
- Create: `back/` (`nest new` v12, sem `@nestjs/mau`, com Prisma 7 + adapter-pg, Vitest, oxlint e prettier, configurado como `terrato/back`)
- Create: `front/` (Vite React-TS + Vitest + jsdom + Testing Library, como `terrato/front`)
- Create: `board/board.mjs`, `board/board.test.mjs`, `board/index.html` (cópia do Terrato com prefixo `IM-`), `board/tasks.json` (`[]`)
- Create: `docs/fluxo.md` (cópia adaptada: trilhas da tabela acima e nomes de agentes definidos pelo Maestro)
- Create: `.github/workflows/ci.yml` (job `verificar` do `terrato/.github/workflows/deploy.yml`, sem o deploy por enquanto)

**Interfaces:**
- Produces: `pnpm test` na raiz roda front + back unit + back e2e; `pnpm --filter back db:deploy`; `node board/board.mjs add|move|assign|comment|list|show`.

- [ ] **Step 1:** Copiar a estrutura e os configs do Terrato (sem código de domínio). Trocar `terrato` por `instamanager` e `TER-` por `IM-`.
- [ ] **Step 2:** Run `node --test board/board.test.mjs`. Expected: PASS.
- [ ] **Step 3:** Run `docker compose up -d db && pnpm install && pnpm test`. Expected: PASS com os testes de exemplo do Nest e um teste de fumaça do `App`.
- [ ] **Step 4:** Commit `chore: estrutura do monorepo, quadro e fluxo [IM-1]`.

### Task 2: Banco e contrato da API

**Files:**
- Create: `back/prisma/schema.prisma`, `back/prisma/migrations/*`, `back/prisma/seed.ts`, `back/prisma/clubes.ts`
- Create: `docs/api.md`
- Test: `back/test/db.e2e-spec.ts`

**Interfaces:**
- Produces (modelos Prisma):
  - `User { id, email @unique, passwordHash, name, avatarPath?, isAdmin=false, pushEnabled=true, createdAt }`
  - `Session { id (sha256 do token), userId, expiresAt }` · `PasswordReset { tokenHash @id, userId, expiresAt, usedAt? }`
  - `Club { id (slug, ex. "palmeiras"), name, crestPath, coachId? @unique }`
  - `CoachTenure { id, clubId, userId, startedAt, endedAt? }`
  - `Post { id, clubId, authorId, caption, createdAt, updatedAt }` · `PostImage { id, postId, position, fullPath, thumbPath, width, height, prompt? }`
  - `Like { postId, userId, @@id([postId,userId]) }` · `Comment { id, postId, userId, text, createdAt }`
  - `TransferRequest { id, userId, kind: SAIR|ASSUMIR, clubId?, status: PENDENTE|APROVADA|RECUSADA, createdAt, decidedAt? }`
  - `PushSubscription { id, userId, endpoint @unique, p256dh, auth }` · `Setting { key @id, value }`
  - Exclusões de `Post` apagam `PostImage`, `Like` e `Comment` em cascata.
- Produces: `docs/api.md` com todas as rotas das Tasks 3–7, os corpos e os códigos de erro (`CONVITE_INVALIDO`, `CLUBE_OCUPADO`, `EMAIL_EM_USO`, `IMAGEM_INVALIDA`, `SEM_CLUBE`, `NAO_E_TECNICO`). Todas as rotas ficam sob `/api`.

- [ ] **Step 1:** Escrever `db.e2e-spec.ts`: `seed cria 20 clubes sem técnico`; `Club.coachId único impede o mesmo usuário em dois clubes` (segundo `update` lança `P2002`).
- [ ] **Step 2:** Run `pnpm --filter back test:e2e db`. Expected: FAIL.
- [ ] **Step 3:** Escrever o schema, a migração e o seed (`clubes.ts` com os 20 clubes da Série A 2026, `crestPath: /escudos/<slug>.svg`; o seed também grava `Setting inviteCode` a partir de `INVITE_CODE`). Escrever `docs/api.md`.
- [ ] **Step 4:** Run o mesmo comando. Expected: PASS.
- [ ] **Step 5:** Commit `feat(db): schema, seed dos clubes e contrato da API [IM-2]`. **Portão:** o Maestro mostra o `docs/api.md` ao Fabio antes das Tasks 3–7.

### Task D1: Fundamentos visuais (Penpot)

Designer. Página "Fundamentos" no projeto Penpot do Fabio: logo, paleta em tema escuro com cara de Instagram, tipografia (fontes locais, sem Google Fonts), tokens, ícones e componentes base (botão, campo, avatar com tag do clube, card de post). Handoff em `docs/design/fundamentos.md` com os tokens em CSS. **Portão:** aprovação do Fabio.

### Task D2: Telas (Penpot)

Designer, em grupos e com aprovação do Fabio por grupo. Todas as telas no celular primeiro (390 px) e com variação desktop simples:
1. Entrar, cadastro (convite → dados → clube livre ou "torcedor"), esqueci a senha, nova senha.
2. Feed (card com carrossel, curtir, comentários), barra inferior (Feed, Galeria, + Postar, Clube, Perfil).
3. Novo post: escolher imagens → legenda + prompt por imagem → publicar, com progresso.
4. Perfil do clube (escudo, técnico atual, grade e histórico de técnicos), perfil da pessoa, galeria de prompts com detalhe e "copiar".
5. Instalar o app (passo a passo do iOS) + permissão de notificação; pedir troca; tela de admin.

Handoff em `docs/design/<grupo>.md`.

### Task 3: Auth — cadastro com convite, login, sessão e recuperação

**Files:**
- Create: `back/src/auth/*`, adaptado de `terrato/back/src/auth` (`password.ts`, `rate-limit.ts`, `session.guard.ts`, `mail.service.ts`, `email-template.ts`, `cookies`, `cleanup.service.ts`). **Sem** Google, sem confirmação de e-mail, sem exclusão de conta.
- Test: `back/test/auth.e2e-spec.ts`, `back/test/recuperacao.e2e-spec.ts`

**Interfaces:**
- Produces:
  - `POST /api/auth/cadastro {convite, email, senha, nome, clubeId|null}` → `201 Me`
  - `POST /api/auth/entrar {email, senha}` → `200 Me` · `POST /api/auth/sair` → `204` · `GET /api/me` → `Me`
  - `POST /api/auth/esqueci {email}` → `204` sempre · `POST /api/auth/redefinir {token, senha}` → `204`, e derruba as outras sessões
  - `Me = { id, nome, email, avatarUrl|null, isAdmin, pushEnabled, clube: {id, nome, escudoUrl}|null }`
  - `PATCH /api/me {nome?, senhaAtual?, senhaNova?, pushEnabled?}` → `Me` (trocar senha exige a atual e derruba as outras sessões) · `PUT /api/me/foto` (multipart, JPEG de até 480 px validado com `ehJpeg` da Task 5) → `Me`
  - `SessionGuard` (põe `req.user`) e `AdminGuard`, usados por todas as tasks seguintes.

- [ ] **Step 1:** Testes e2e:
  - `convite errado → 400 CONVITE_INVALIDO`;
  - `cadastro com clube livre cria CoachTenure aberta e Me.clube preenchido`;
  - `cadastro com clubeId null → torcedor (Me.clube null)`;
  - `dois cadastros simultâneos no mesmo clube → um 201 e um 409 CLUBE_OCUPADO, e só 1 usuário criado` (via `Promise.all`, criação em `$transaction`);
  - `email repetido → 409 EMAIL_EM_USO`;
  - `email === ADMIN_EMAIL → isAdmin true`;
  - `esqueci + redefinir com token vencido (>1h) → 400`;
  - `token reutilizado → 400`.
  - `PATCH /api/me com senhaAtual errada → 400`.
- [ ] **Step 2:** Run `pnpm --filter back test:e2e auth recuperacao`. Expected: FAIL.
- [ ] **Step 3:** Implementar adaptando o Terrato. Criar o usuário, ocupar o clube e abrir a tenure numa mesma `$transaction`. `P2002` em `coachId` vira `409 CLUBE_OCUPADO`.
- [ ] **Step 4:** Run o mesmo comando. Expected: PASS.
- [ ] **Step 5:** Commit `feat(auth): cadastro com convite e clube, login e recuperação [IM-3]`.

### Task 4: Clubes e perfil do clube

**Files:** Create `back/src/clubes/*`, `front/public/escudos/<slug>.svg` (20 escudos de fonte pública, conferidos pelo Fabio). Test `back/test/clubes.e2e-spec.ts`.

**Interfaces:**
- Produces:
  - `GET /api/clubes?livres=1` (público, usado no cadastro) → `[{id, nome, escudoUrl, tecnico: {id,nome}|null}]`
  - `GET /api/clubes/:id` → `{id, nome, escudoUrl, tecnico, historico: [{usuario:{id,nome}, inicio, fim|null}]}`, com o histórico do mais novo para o mais velho.

- [ ] **Step 1:** Testes: `livres=1 omite clube com técnico`; `histórico lista a tenure fechada com fim e a aberta com fim null`.
- [ ] **Step 2:** Run `pnpm --filter back test:e2e clubes`. Expected: FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit `feat(clubes): lista e perfil com histórico [IM-4]`.

### Task 5: Posts, imagens, feed e galeria (back)

**Files:** Create `back/src/posts/*` (`posts.controller.ts`, `posts.service.ts`, `imagens.ts`). Test `back/src/posts/imagens.spec.ts`, `back/test/posts.e2e-spec.ts`.

**Interfaces:**
- Consumes: `SessionGuard`, `AdminGuard` (Task 3).
- Produces:
  - `POST /api/posts` multipart (`FilesInterceptor` do `@nestjs/platform-express`, que já vem no Nest). Campos: `legenda`, `prompts` (JSON `string|null[]`), arquivos `cheia[]` + `mini[]` na mesma ordem (de 1 a 10 pares). Resposta: `201 Post`.
  - `GET /api/posts?antes=<cursor>&clube=<id>` → `{itens: Post[], proximo: string|null}`, com 12 posts por página.
  - `GET /api/posts/:id` · `PATCH /api/posts/:id {legenda?, prompts?}` · `DELETE /api/posts/:id`
  - `GET /api/galeria?antes=&clube=` → `{itens: [{imagemId, postId, miniUrl, cheiaUrl, prompt, clube}], proximo}` (só imagens com prompt)
  - `Post = {id, clube:{id,nome,escudoUrl}, autor:{id,nome}, legenda, criadoEm, imagens:[{id, miniUrl, cheiaUrl, largura, altura, prompt|null}], curtidas, curtiu, comentarios, podeEditar}`
  - `imagens.ts`: `ehJpeg(buf: Buffer): boolean` e `salvarImagem(buf: Buffer, pasta: string): Promise<string>` (nome aleatório `.jpg` em `UPLOADS_DIR`, devolve o caminho público `/uploads/...`).
  - Evento interno `posts.criado(postId)`, que a Task 7 consome. Usa o `EventEmitter` do Node num provider, sem dependência nova.

- [ ] **Step 1:** Unit `ehJpeg`: `true` para `FF D8 FF E0…`; `false` para PNG e para um buffer vazio.
- [ ] **Step 2:** E2E:
  - `torcedor posta → 403 SEM_CLUBE`;
  - `post com 11 imagens → 400`;
  - `arquivo PNG renomeado → 400 IMAGEM_INVALIDA e nada gravado no disco`;
  - `arquivo > 3 MB → 413`;
  - `feed pagina por cursor: 13 posts → 12 + proximo, depois 1 + null`;
  - `após troca de técnico, ex-técnico PATCH → 403 NAO_E_TECNICO e novo técnico PATCH → 200`;
  - `admin DELETE post de outro → 204 e arquivos apagados`;
  - `galeria só traz imagens com prompt`.
- [ ] **Step 3:** Run `pnpm --filter back test posts && pnpm --filter back test:e2e posts`. Expected: FAIL.
- [ ] **Step 4:** Implementar. `podeEditar = user.isAdmin || club.coachId === user.id`. O cursor é o `id` (cuid ordenável) ou `criadoEm|id`, à escolha do dev.
- [ ] **Step 5:** Run. Expected: PASS.
- [ ] **Step 6:** Commit `feat(posts): upload, feed, edição e galeria [IM-5]`.

### Task 6: Curtidas, comentários, trocas de time e admin (back)

**Files:** Create `back/src/interacoes/*`, `back/src/trocas/*`, `back/src/admin/*`. Test `back/test/interacoes.e2e-spec.ts`, `back/test/trocas.e2e-spec.ts`.

**Interfaces:**
- Produces:
  - `PUT /api/posts/:id/curtida` → `204` · `DELETE /api/posts/:id/curtida` → `204` (as duas são idempotentes)
  - `GET /api/posts/:id/comentarios` → `[{id, texto, criadoEm, usuario:{id,nome,avatarUrl, clube:{id,nome}|null}}]` · `POST` → `201` · `DELETE /api/comentarios/:id` (autor ou admin)
  - `POST /api/trocas {tipo:'SAIR'|'ASSUMIR', clubeId?}` → `201` (um pedido pendente por pessoa; `ASSUMIR` exige clube livre na hora do pedido) · `GET /api/trocas/minhas`
  - Admin: `GET /api/admin/trocas?status=PENDENTE` · `POST /api/admin/trocas/:id/aprovar` · `POST .../recusar` · `GET|PUT /api/admin/convite {codigo}` · `POST /api/admin/clubes/:id/remover-tecnico`
  - Eventos `comentarios.criado(commentId)`, `trocas.pedida(id)`, `trocas.decidida(id)`.

- [ ] **Step 1:** E2E:
  - `curtir duas vezes conta 1`;
  - `comentário de 1001 chars → 400`;
  - `comentário mostra a tag do clube atual de quem comentou`;
  - `aprovar ASSUMIR: fecha a tenure antiga, abre a nova e move coachId`;
  - `aprovar ASSUMIR com clube ocupado depois do pedido → 409 CLUBE_OCUPADO e o pedido segue PENDENTE`;
  - `aprovar SAIR → pessoa vira torcedor e os posts ficam no clube`;
  - `segundo pedido pendente → 409`;
  - `não-admin em /api/admin/* → 403`;
  - `PUT convite → cadastro com o código antigo falha`.
- [ ] **Step 2:** Run `pnpm --filter back test:e2e interacoes trocas`. Expected: FAIL.
- [ ] **Step 3:** Implementar. A aprovação roda numa `$transaction`.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit `feat: curtidas, comentários, trocas e admin [IM-6]`.

### Task 7: Push (back) — **portão: dependência `web-push`**

**Files:** Create `back/src/push/*`. Test `back/src/push/push.service.spec.ts`, `back/test/push.e2e-spec.ts`. `.env.example` ganha `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` e `VAPID_SUBJECT=mailto:...`.

**Interfaces:**
- Consumes: eventos das Tasks 5 e 6.
- Produces:
  - `GET /api/push/chave` → `{chave}` · `POST /api/push/inscricao {endpoint, keys:{p256dh,auth}}` (upsert por endpoint) · `DELETE /api/push/inscricao {endpoint}` · `pushEnabled` via `PATCH /api/me` (Task 3)
  - `PushService.enviar(userIds: string[], msg: {titulo, corpo, url}): Promise<void>`
  - Mensagens:
    - post novo: `"<Clube>"` / `"<técnico> postou"` → `/p/<id>`;
    - comentário: `"Novo comentário"` / `"<nome>: <texto 80 chars>"` → `/p/<id>`;
    - pedido de troca: `"Pedido de troca"` → `/admin`;
    - decisão: `"Troca aprovada"` ou `"Troca recusada"` → `/perfil`.

- [ ] **Step 1:** Unit com `web-push` mockado:
  - `post novo envia para todos com pushEnabled menos o autor`;
  - `comentário do próprio técnico não envia`;
  - `resposta 410 apaga a inscrição e continua as outras`;
  - `erro 500 de um endpoint não derruba os outros` (`Promise.allSettled`).
- [ ] **Step 2:** Run `pnpm --filter back test push`. Expected: FAIL.
- [ ] **Step 3:** Implementar. O envio roda depois da resposta HTTP e nunca atrasa o post.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit `feat(push): notificações de post, comentário e troca [IM-7]`.

### Task 8: Base do front — shell, API, PWA

**Files:**
- Create: `front/src/rotas.tsx` (cópia do Terrato, com parâmetros `/p/:id`, `/c/:id`)
- Create: `front/src/api/cliente.ts`, `front/src/App.tsx`, `front/src/tokens.css` (do handoff D1), `front/src/BarraInferior.tsx`
- Create: `front/public/manifest.webmanifest`, `front/public/sw.js`, `front/public/icones/*`
- Create: `front/nginx.conf`, adaptado do Terrato: SPA, `/api` → back, `/uploads` → volume com `Cache-Control: public, max-age=31536000, immutable`

**Interfaces:**
- Produces:
  - `api<T>(caminho: string, init?: RequestInit): Promise<T>`, que lança `ErroApi {status, codigo}`
  - `useMe(): {me: Me|null, carregando: boolean, recarregar(): void}`
  - `useRota(): {caminho: string, params: Record<string,string>}`
  - `sw.js` trata `push` (mostra notificação) e `notificationclick` (abre ou foca `data.url`). Sem cache offline (*shortcut: sem modo offline; ver na v1.1 se fizer falta*).

- [ ] **Step 1:** Testes:
  - `rota /p/abc → params.id = 'abc'`;
  - `sem sessão, qualquer rota privada mostra Entrar`;
  - `api() com 409 lança ErroApi com codigo do corpo`.
- [ ] **Step 2:** Run `pnpm --filter front test`. Expected: FAIL.
- [ ] **Step 3:** Implementar e validar o `nginx.conf` com `docker run --rm -v $PWD/front/nginx.conf:/etc/nginx/conf.d/default.conf:ro nginx nginx -t` (lição do Terrato).
- [ ] **Step 4:** Run. Expected: PASS e `nginx -t` ok.
- [ ] **Step 5:** Commit `feat(front): shell, cliente da API e PWA [IM-8]`.

### Task 9: Telas de conta (front)

**Files:** Create `front/src/conta/*` (Entrar, Cadastro, Esqueci, NovaSenha, Perfil). Test `front/src/conta/*.test.tsx`.

**Interfaces:**
- Consumes: Tasks 3, 4 e 8, e o handoff D2 grupo 1.

- [ ] **Step 1:** Testes:
  - `cadastro mostra só clubes livres + opção torcedor`;
  - `409 CLUBE_OCUPADO → mensagem "Esse clube acabou de ser escolhido" e a lista recarrega`;
  - `convite inválido → mensagem no campo do convite`;
  - `perfil salva nome, foto e senha` (a foto passa pela compressão da Task 11 em 480 px).
- [ ] **Step 2:** Run `pnpm --filter front test conta`. Expected: FAIL.
- [ ] **Step 3:** Implementar seguindo o handoff.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit `feat(conta): entrar, cadastro, senha e perfil [IM-9]`.

### Task 10: Feed e card de post (front)

**Files:** Create `front/src/feed/*` (`Feed.tsx`, `CardPost.tsx`, `Carrossel.tsx`, `Comentarios.tsx`, `PostPagina.tsx` em `/p/:id`). Test `front/src/feed/*.test.tsx`.

- [ ] **Step 1:** Testes:
  - `feed carrega a próxima página ao chegar no fim` (IntersectionObserver mockado);
  - `curtir atualiza o contador na hora e desfaz se a API falhar`;
  - `card usa miniUrl e lazy, nunca cheiaUrl`;
  - `comentário mostra a tag do clube`;
  - `botões editar e apagar só aparecem com podeEditar`.
- [ ] **Step 2:** Run `pnpm --filter front test feed`. Expected: FAIL.
- [ ] **Step 3:** Implementar. O carrossel usa CSS scroll-snap, sem dependência.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit `feat(feed): feed, card, curtidas e comentários [IM-10]`.

### Task 11: Novo post com compressão no celular (front)

**Files:** Create `front/src/postar/*` (`Postar.tsx`, `comprimir.ts`). Test `front/src/postar/*.test.ts(x)`.

**Interfaces:**
- Produces: `comprimir(arquivo: File, ladoMax: number): Promise<{blob: Blob, largura: number, altura: number}>`. Usa `createImageBitmap` (com `imageOrientation: 'from-image'`) → canvas → `toBlob('image/jpeg', 0.82)`. Lança `ErroImagem` se não conseguir decodificar.

- [ ] **Step 1:** Testes:
  - `comprimir 4000×3000 com ladoMax 1600 → 1600×1200`;
  - `imagem menor que ladoMax não aumenta`;
  - `arquivo ilegível → ErroImagem` (com o canvas e o `createImageBitmap` mockados);
  - `torcedor abrindo /postar vê "Só técnicos postam" e o link para pedir clube`;
  - `publicar envia cheia[] e mini[] na mesma ordem dos prompts`.
- [ ] **Step 2:** Run `pnpm --filter front test postar`. Expected: FAIL.
- [ ] **Step 3:** Implementar. Fluxo de 3 passos do handoff, com `<input type="file" accept="image/*" multiple>` (o iOS converte HEIC em JPEG nesse caminho) e barra de progresso.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit `feat(postar): novo post com compressão no celular [IM-11]`.

### Task 12: Perfil do clube e galeria de prompts (front)

**Files:** Create `front/src/clube/*` (`/c/:id`), `front/src/galeria/*` (`/galeria`). Test junto.

- [ ] **Step 1:** Testes:
  - `perfil mostra técnico atual e histórico com "até hoje" na tenure aberta`;
  - `clube sem técnico mostra "Vaga aberta"`;
  - `galeria: tocar abre o detalhe e "copiar prompt" chama navigator.clipboard.writeText com o texto exato`;
  - `filtro por clube refaz a busca com ?clube=`.
- [ ] **Step 2:** Run `pnpm --filter front test clube galeria`. Expected: FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit `feat: perfil do clube e galeria de prompts [IM-12]`.

### Task 13: Instalar o app e ativar push (front)

**Files:** Create `front/src/instalar/*`. Test junto.

**Interfaces:**
- Consumes: `GET /api/push/chave`, `POST|DELETE /api/push/inscricao`, `PATCH /api/me` (Task 7).
- Produces: `ativarPush(): Promise<'ok'|'negado'|'sem-suporte'>`.

- [ ] **Step 1:** Testes:
  - `iPhone fora da tela inicial (navigator.standalone false) → mostra o passo a passo de instalar e não pede permissão`;
  - `instalado → botão "Ativar notificações" chama Notification.requestPermission e envia a inscrição`;
  - `permissão negada → mensagem de como liberar nos ajustes`;
  - `desligar no perfil → DELETE inscrição + pushEnabled false`.
- [ ] **Step 2:** Run `pnpm --filter front test instalar`. Expected: FAIL.
- [ ] **Step 3:** Implementar. A tela aparece uma vez depois do primeiro login (flag no `localStorage`) e pode ser reaberta pelo perfil.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit `feat(push): instalar o app e ativar notificações [IM-13]`.

### Task 14: Trocas de time e admin (front)

**Files:** Create `front/src/trocas/*`, `front/src/admin/*` (`/admin`, visível só com `me.isAdmin`). Test junto.

- [ ] **Step 1:** Testes:
  - `pedido pendente mostra status e bloqueia novo pedido`;
  - `ASSUMIR lista só clubes livres`;
  - `admin aprova → item sai da lista`;
  - `409 na aprovação → mensagem "Clube ocupado, recuse ou espere"`;
  - `trocar convite mostra o código novo para copiar`;
  - `não-admin em /admin → volta ao feed`.
- [ ] **Step 2:** Run `pnpm --filter front test trocas admin`. Expected: FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit `feat: pedidos de troca e tela de admin [IM-14]`.

### Task 15: QA ponta a ponta (QA)

O QA usa o app no portal do Maestri, no tamanho de celular. Roteiro:
1. Cadastro com convite, como técnico e como torcedor.
2. Postar 3 fotos grandes com prompt.
3. Ver no feed, curtir e comentar.
4. Abrir a galeria e copiar o prompt.
5. Pedir troca, aprovar como admin e conferir o histórico.
6. Ex-técnico sem botão de editar.
7. Recuperar senha (e-mail de teste do Resend).

Bugs viram cards em `correcao`. Fecha com tudo aprovado.

### Task 16: Deploy — **portão: VPS e push**

**Files:** Create `docker-compose.prod.yml` (cópia do Terrato com volume `uploads` montado no `back` em `/app/uploads` e no `web` em `/usr/share/nginx/uploads`, e host `Host(\`instamanager.fj-dev.tech\`)`), `.github/workflows/deploy.yml` (verificar + deploy por SSH, como no Terrato) e `.github/workflows/saude.yml`.

- [ ] **Step 1:** O Fabio cria o repositório privado no GitHub e o `.env` da VPS (`INVITE_CODE`, `ADMIN_EMAIL`, VAPID, Resend, Postgres, `COOKIE_SECRET`).
- [ ] **Step 2:** Após a confirmação do Fabio: push, deploy e `curl https://instamanager.fj-dev.tech/api/health` → `200`.
- [ ] **Step 3:** Após a confirmação do Fabio: incluir no `~/projetos/infra/backup/backup.sh` o dump do banco e um `tar` do volume `uploads`.
- [ ] **Step 4:** Teste real: instalar no iPhone e no Android, ativar push e postar de um aparelho para o outro receber.
