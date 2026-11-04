# API do InstaManager (v1)

Contrato das Tasks 3–7. Tudo sob `/api`, JSON, UTF-8. Qualquer rota fora desta lista não existe na v1.

## Convenções

- **Sessão:** cookie opaco `HttpOnly` (`SameSite=Lax`, `Secure` em produção). O banco guarda o sha256 do token. Duração: 30 dias. Rotas marcadas 🔒 exigem sessão (`401 NAO_AUTENTICADO` sem ela); 👑 exigem também `isAdmin` (`403 NAO_E_ADMIN`).
- **Origin:** métodos que mudam estado conferem `Origin` contra `APP_URL` (`403 ORIGEM_INVALIDA`), como no Terrato.
- **Erro:** `{ "codigo": "CODIGO", "mensagem": "texto em português" }` com o status HTTP. Erros de validação: `400 DADOS_INVALIDOS` (com `campos: string[]`).
- **Ids:** UUID, exceto clube (slug, ex. `palmeiras`). **Datas:** ISO 8601 em UTC.
- **Imagens:** URLs relativas (`/uploads/<nome>.jpg`, `/escudos/<slug>.svg`), servidas pelo nginx.
- **Limites:** legenda ≤ 2200, prompt ≤ 4000, comentário ≤ 1000 caracteres; nome 1–60; senha ≥ 8; post com 1–10 imagens; cada arquivo ≤ 3 MB e começando com `FF D8 FF`.
- **Rate limit** (por IP, como no Terrato): cadastro, entrar, esqueci e redefinir → `429 MUITAS_TENTATIVAS`.

### Códigos de erro

| Código | Status | Quando |
|---|---|---|
| `CONVITE_INVALIDO` | 400 | código de convite errado |
| `EMAIL_EM_USO` | 409 | e-mail já cadastrado |
| `CLUBE_OCUPADO` | 409 | o clube já tem técnico (cadastro ou aprovação de troca) |
| `IMAGEM_INVALIDA` | 400 | arquivo sem assinatura JPEG |
| `SEM_CLUBE` | 403 | torcedor tentando postar |
| `NAO_E_TECNICO` | 403 | editar/apagar post sem ser técnico atual do clube nem admin |
| `CREDENCIAIS_INVALIDAS` | 401 | e-mail ou senha errados |
| `SENHA_ATUAL_INVALIDA` | 400 | `senhaAtual` errada no `PATCH /me` |
| `TOKEN_INVALIDO` | 400 | token de redefinição vencido (> 1 h), usado ou inexistente |
| `TROCA_PENDENTE` | 409 | já existe pedido pendente da pessoa |
| `TROCA_JA_DECIDIDA` | 409 | aprovar/recusar um pedido que não está mais `PENDENTE` |
| `NAO_E_AUTOR` | 403 | apagar comentário de outra pessoa sem ser admin |
| `EMOJI_INVALIDO` | 400 | emoji fora da lista de reações |
| `LIMITE_FIXADOS` | 409 | fixar o 4º post |
| `NAO_ENCONTRADO` | 404 | id inexistente |

## Tipos

```
Me      = { id, nome, email, avatarUrl|null, isAdmin, pushEnabled, clube: ClubeMini|null }
ClubeMini = { id, nome, escudoUrl }
Post    = { id, clube: ClubeMini, autor: {id, nome}, legenda, texto|null, fixado, oculto, criadoEm,
            imagens: [{ id, miniUrl, cheiaUrl, largura, altura, prompt|null }],
            curtidas, curtiu, reacoes: [{emoji, total}], minhaReacao|null, comentarios, podeEditar }
            // oculto: ocultado pelo admin (só o admin vê posts com oculto: true).
            // texto: post só de texto (imagens = [], legenda = ""). curtidas = total de reações (qualquer emoji);
            // curtiu = tem reação; reacoes = até 3 emojis, o mais usado primeiro.
Pagina<T> = { itens: T[], proximo: string|null }   // proximo = cursor opaco para ?antes=
```

`podeEditar = user.isAdmin || clube.coachId === user.id`. `autor` é quem era o técnico ao publicar.

## 1. Conta (Task 3)

| Rota | Corpo | Resposta |
|---|---|---|
| `POST /api/auth/cadastro` | `{convite, email, senha, nome, clubeId: string\|null}` | `201 Me` + cookie. `null` = torcedor. Erros: `CONVITE_INVALIDO`, `EMAIL_EM_USO`, `CLUBE_OCUPADO`, `404` se o clube não existe. Cria usuário, ocupa o clube e abre a `CoachTenure` numa transação. E-mail igual a `ADMIN_EMAIL` vira admin. |
| `POST /api/auth/entrar` | `{email, senha}` | `200 Me` + cookie · `CREDENCIAIS_INVALIDAS` |
| `POST /api/auth/sair` 🔒 | — | `204` |
| `POST /api/auth/esqueci` | `{email}` | `204` sempre (não revela se o e-mail existe). Link por Resend válido por 1 h: `APP_URL/nova-senha?token=…` |
| `POST /api/auth/redefinir` | `{token, senha}` | `204` · `TOKEN_INVALIDO`. Uso único; derruba as outras sessões. |
| `GET /api/me` 🔒 | — | `Me` |
| `PATCH /api/me` 🔒 | `{nome?, senhaAtual?, senhaNova?, pushEnabled?}` | `Me`. Trocar senha exige `senhaAtual`, derruba as outras sessões e apaga as inscrições de push da conta (o aparelho atual se inscreve de novo). |
| `PUT /api/me/foto` 🔒 | multipart `foto` (JPEG ≤ 480 px) | `Me` · `IMAGEM_INVALIDA` |

## 2. Clubes (Task 4)

| Rota | Resposta |
|---|---|
| `GET /api/clubes?livres=1` (pública) | `[{id, nome, escudoUrl, tecnico: {id,nome}\|null}]`, por nome. Com `livres=1`, só os sem técnico. |
| `GET /api/clubes/:id` 🔒 | `{id, nome, escudoUrl, bio\|null, capaUrl\|null, tecnico, historico: [{usuario:{id,nome}, inicio, fim\|null}]}`, do mais novo ao mais velho. `fim null` = técnico atual. |
| `PATCH /api/clubes/:id` 🔒 | `{bio}` (≤ 300; vazio apaga) | o mesmo objeto do `GET`. Só o técnico atual ou o admin (`403 NAO_E_TECNICO`, ex-técnico inclusive); `400` se > 300. |
| `PUT /api/clubes/:id/capa` 🔒 | multipart `capa` (JPEG ≤ 3 MB; o app manda 1500×500 comprimido) | o mesmo objeto do `GET`; apaga a capa antiga do disco. `IMAGEM_INVALIDA`, `413`, `403` como na bio. |

## 3. Posts, feed e galeria (Task 5) 🔒

| Rota | Corpo | Resposta |
|---|---|---|
| `POST /api/posts` | multipart com os campos `legenda`, `prompts` (JSON `(string\|null)[]`), `cheia` e `mini`: cada arquivo vai como uma repetição do campo (`cheia` repetido 1–10 vezes, `mini` idem, **na mesma ordem**); o `[]` que aparece em outros pontos é só notação de lista, o nome do campo é `cheia`/`mini` sem colchetes (1–10 pares). **Post só de texto:** 0 arquivos e o campo `texto` (1–500 caracteres, sem espaços nas pontas); com imagens, `texto` não é aceito | `201 Post`. Sem arquivos e sem `texto` válido → `400 DADOS_INVALIDOS`. `SEM_CLUBE`, `IMAGEM_INVALIDA`, `413` se > 3 MB, `400` se > 10 imagens ou `cheia` e `mini` com tamanhos diferentes. Nada é gravado em disco se algum arquivo for inválido. Emite `posts.criado`. |
| `GET /api/posts?antes=&clube=&tag=` | — | `Pagina<Post>`, 12 por página, do mais novo ao mais velho. Sem `antes` e sem `clube` (1ª página do feed geral) vem também `fixados: Post[]` (por `pinnedAt` desc, máx. 3); sem `clube`, fixados nunca entram em `itens`. Com `tag=contratacao`: mesma resposta, só posts com `#contratacao` na legenda ou no texto (sem acento nem maiúsculas, palavra inteira; `#` dentro de URL ou colado em palavra não conta), sem `fixados`. |
| `GET /api/posts/:id` | — | `Post` |
| `PATCH /api/posts/:id` | `{legenda?, prompts?}` (`prompts` na ordem das imagens) | `Post` · `NAO_E_TECNICO` |
| `DELETE /api/posts/:id` | — | `204`, apaga curtidas, comentários e arquivos · `NAO_E_TECNICO` (admin pode qualquer um) |
| `GET /api/galeria?antes=&clube=&favoritos=1` | — | `Pagina<{imagemId, postId, miniUrl, cheiaUrl, prompt, clube: ClubeMini, favorito}>`, só imagens com prompt. Com `favoritos=1`, só as que eu favoritei. |
| `PUT /api/galeria/:imagemId/favorito` | — | `204` (idempotente) · `404` |
| `DELETE /api/galeria/:imagemId/favorito` | — | `204` (idempotente) |
| `PUT /api/posts/:id/ocultar-para-mim` | — | `204` (idempotente). O post some das listas só de quem pediu. |
| `DELETE /api/posts/:id/ocultar-para-mim` | — | `204` (idempotente) |

Cursor: `criadoEm|id` codificado em base64url (`400 DADOS_INVALIDOS` se estiver malformado). A galeria pagina de 24 em 24 (o feed, de 12 em 12). Largura e altura de cada imagem são lidas do JPEG da `cheia` no servidor.

## 4. Curtidas, comentários, trocas e admin (Task 6) 🔒

| Rota | Corpo | Resposta |
|---|---|---|
| `PUT /api/posts/:id/reacao` | `{emoji}` (`❤️ 🔥 😂 😮 😢 👏`) | `204`. Uma reação por pessoa: reagir de novo troca o emoji. `400 EMOJI_INVALIDO` fora da lista. |
| `DELETE /api/posts/:id/reacao` | — | `204` (idempotente) |
| `PUT /api/posts/:id/curtida` | — | `204`. Apelido de `PUT .../reacao {emoji:'❤️'}` (compatibilidade com o app antigo). |
| `DELETE /api/posts/:id/curtida` | — | `204` (idempotente). Apelido de `DELETE .../reacao`. |
| `GET /api/posts/:id/comentarios` | — | `[{id, texto, criadoEm, usuario: {id, nome, avatarUrl\|null, clube: {id,nome}\|null}}]`, do mais velho ao mais novo. `clube` é o atual de quem comentou. |
| `POST /api/posts/:id/comentarios` | `{texto}` | `201` comentário · `400` se vazio ou > 1000. Emite `comentarios.criado`. |
| `DELETE /api/comentarios/:id` | — | `204` (autor ou admin) · `403 NAO_E_AUTOR` |
| `POST /api/trocas` | `{tipo: 'SAIR'\|'ASSUMIR', clubeId?}` | `201 {id, tipo, clubeId, status, criadoEm, decididoEm}` (`clubeId` só no `ASSUMIR`). `ASSUMIR` exige `clubeId` livre agora (`CLUBE_OCUPADO`); `SAIR` exige ter clube (`SEM_CLUBE`). `TROCA_PENDENTE` se já houver um. Emite `trocas.pedida`. |
| `GET /api/trocas/minhas` | — | lista dos pedidos da pessoa, do mais novo ao mais velho |
| `GET /api/admin/trocas?status=PENDENTE` 👑 | — | `[{id, tipo, status, criadoEm, usuario:{id,nome}, clubeAtual: ClubeMini\|null, clubeDesejado: ClubeMini\|null}]` |
| `POST /api/admin/trocas/:id/aprovar` 👑 | — | `204`. Numa transação: fecha a tenure do clube antigo, solta o `coachId`, e (se `ASSUMIR`) abre a nova tenure e move o `coachId`. Clube ocupado depois do pedido → `409 CLUBE_OCUPADO`, nada muda, pedido segue `PENDENTE`. Emite `trocas.decidida`. |
| `POST /api/admin/trocas/:id/recusar` 👑 | — | `204`. Emite `trocas.decidida`. |
| `PUT /api/admin/posts/:id/fixar` 👑 | — | `204` (idempotente). Máx. 3 fixados: o 4º → `409 LIMITE_FIXADOS`. |
| `DELETE /api/admin/posts/:id/fixar` 👑 | — | `204` (idempotente). |
| `PUT /api/admin/posts/:id/ocultar` 👑 | — | `204` (idempotente). Para quem não é admin o post some do feed, clube, galeria, tag e fixados, e `/api/posts/:id` (e reação/comentário nele) dá `404`. Ocultar também desafixa o post (libera a vaga dos 3); mostrar de novo não volta a fixar. |
| `DELETE /api/admin/posts/:id/ocultar` 👑 | — | `204`: volta a aparecer. |
| `PUT\|DELETE /api/admin/comentarios/:id/ocultar` 👑 | — | `204`. Comentário oculto some da lista e da contagem para quem não é admin; o admin vê com `oculto: true`. |
| `POST /api/denuncias` | `{postId}` ou `{commentId}` (um só), `motivo?` (≤ 300) | `201 {id}` · `400` · `404` se não existe ou a pessoa não enxerga. Denúncia aberta repetida da mesma pessoa no mesmo alvo é ignorada: `201` com o `id` da que já existe. |
| `GET /api/admin/denuncias?abertas=1&antes=` 👑 | — | `Pagina<{id, criadoEm, motivo\|null, resolvidaEm\|null, denunciante:{id,nome}, post:{id,legenda,texto,clubeId}\|null, comentario:{id,texto,postId}\|null}>`, 20 por página (cursor `antes`), mais novas primeiro. Com `abertas=1`, só as não resolvidas. |
| `POST /api/admin/denuncias/:id/resolver` 👑 | — | `204` (idempotente) · `404` |
| `GET /api/admin/convite` 👑 | — | `{codigo}` |
| `PUT /api/admin/convite` 👑 | `{codigo}` (4 a 64 caracteres) | `{codigo}`, já sem espaços nas pontas e em maiúsculas. O código antigo para de valer. O cadastro não diferencia maiúsculas de minúsculas (nem espaços nas pontas). |
| `POST /api/admin/clubes/:id/remover-tecnico` 👑 | — | `204`: fecha a tenure e deixa a pessoa como torcedora. |

Apagar post e comentário pelo admin usa as mesmas rotas de §3 e §4.

## 5. Push (Task 7) 🔒

| Rota | Corpo | Resposta |
|---|---|---|
| `GET /api/push/chave` | — | `{chave}` (VAPID pública) · `503 PUSH_INDISPONIVEL` se o servidor não tem VAPID |
| `POST /api/push/inscricao` | `{endpoint, keys: {p256dh, auth}}` | `204` (upsert por endpoint; se outra pessoa entrar no mesmo aparelho, a inscrição passa para ela). `400` se o endpoint não for `https` de um serviço de push conhecido (`fcm.googleapis.com`, `*.push.services.mozilla.com`, `web.push.apple.com`, `*.notify.windows.com`, sem porta nem usuário), porque o servidor faz POST nele. **O front chama `DELETE /api/push/inscricao` antes de `POST /auth/sair`** (senão o aparelho segue recebendo push de quem saiu); redefinir a senha apaga todas as inscrições da conta. |
| `DELETE /api/push/inscricao` | `{endpoint}` | `204` (só apaga a inscrição da própria pessoa) |

Ligar/desligar: `PATCH /api/me {pushEnabled}`. Mensagens (`titulo` / `corpo` → `url`): post novo `"<Clube>"` / `"<técnico> postou"` → `/p/<id>`; comentário `"Novo comentário"` / `"<nome>: <80 chars>"` → `/p/<id>`; pedido de troca (só para admins, menos quem pediu) `"Pedido de troca"` → `/admin`; decisão `"Troca aprovada"` ou `"Troca recusada"` → `/perfil`. Inscrição que responde 404/410 é apagada.

## 6. Modelo de dados

Ver `back/prisma/schema.prisma`: `User`, `Session`, `PasswordReset`, `Club` (`coachId @unique`), `CoachTenure`, `Post`, `PostImage`, `Like`, `Comment`, `TransferRequest`, `PushSubscription`, `Setting`. Apagar `Post` apaga `PostImage`, `Like` e `Comment`. `/health` fica fora do contrato (`GET /api/health`).

## 7. Variáveis de ambiente

`DATABASE_URL`, `APP_URL`, `INVITE_CODE` (valor inicial do convite, só no seed), `ADMIN_EMAIL`, `UPLOADS_DIR`, `RESEND_API_KEY`, `MAIL_FROM`, `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`/`VAPID_SUBJECT` (Task 7).

Em produção, atrás do Traefik/nginx: `TRUST_PROXY=1` (sem isso o rate limit enxerga o IP do proxy e conta todo mundo junto).
