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
| `CLUBE_OCUPADO` | 409 | o clube já tem técnico, ou é a CBF, que nunca tem (cadastro, pedido ou aprovação de troca) |
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
| `NAO_E_ADMIN` | 403 | rota 👑, ou `comoCbf` sem ser admin |
| `PLACAR_PENDENTE` | 409 | fechar rodada/fase com jogo sem placar |
| `FASE_FECHADA` | 409 | lançar jogos ou fechar uma fase da Copa já fechada |
| `FASE_ABERTA` | 409 | reabrir/publicar resumo de fase aberta |
| `ORDEM_REPETIDA` | 409 | criar fase da Copa com `ordem` já usada |
| `CLUBE_ELIMINADO` | 409 | clube que perdeu um jogo da Copa numa fase de ordem maior |
| `PRAZO_ENCERRADO` | 409 | palpite em jogo cujo prazo acabou (ou que ainda não tem prazo) |
| `RODADA_FECHADA` | 409 | lançar jogos numa rodada fechada (ou fechar uma já fechada) |
| `RODADA_ABERTA` | 409 | reabrir uma rodada que já está aberta |
| `VOTACAO_ENCERRADA` | 409 | votar depois do prazo ou da votação encerrada; encerrar de novo |
| `JA_VOTOU` | 409 | segundo voto da mesma pessoa na votação |
| `CORPO_GRANDE` | 413 | `POST /api/erros-front` com corpo > 4 KB |
| `NAO_ENCONTRADO` | 404 | id inexistente |

## Tipos

```
Me      = { id, nome, email, avatarUrl|null, isAdmin, pushEnabled, pushPrefs: {posts,comentarios,mencoes,cbf,bolao,trocas: boolean}, clube: ClubeMini|null }
ClubeMini = { id, nome, escudoUrl }
Post    = { id, clube: ClubeMini, autor: {id, nome}, legenda, texto|null, mencoes: [{id, nome}], fixado, oculto, criadoEm,
            imagens: [{ id, miniUrl, cheiaUrl, largura, altura, prompt|null }],
            video: { url, capaUrl, duracaoS, largura, altura } | null,   // post de vídeo: imagens = []
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
| `PATCH /api/me` 🔒 | `{nome?, senhaAtual?, senhaNova?, pushEnabled?, pushPrefs?}` | `Me`. Trocar senha exige `senhaAtual`, derruba as outras sessões e apaga as inscrições de push da conta (o aparelho atual se inscreve de novo). |
| `PUT /api/me/foto` 🔒 | multipart `foto` (JPEG ≤ 480 px) | `Me` · `IMAGEM_INVALIDA` |

## 2. Clubes (Task 4)

| Rota | Resposta |
|---|---|
| `GET /api/clubes?livres=1` (pública) | `[{id, nome, escudoUrl, tecnico: {id,nome}\|null}]`, por nome. Com `livres=1`, só os sem técnico, e a **CBF** (`id 'cbf'`, clube oficial) nunca entra na lista. Nem com nem sem o filtro: a CBF só aparece em `GET /api/clubes/cbf` e como `clube` de posts. |
| `GET /api/clubes/:id` 🔒 | `{id, nome, escudoUrl, bio\|null, capaUrl\|null, tecnico, liga: {posicao, ultimos, pontos, jogos}\|null, selos: [{titulo, createdAt}], historico: [{usuario:{id,nome}, inicio, fim\|null}]}`, do mais novo ao mais velho. `fim null` = técnico atual. `liga` é a posição na tabela, os pontos (P), os jogos (J) e os últimos resultados (`('V'\|'E'\|'D')[]`, até 5); **`null` para a CBF**. `selos`: os selos ganhos em votações, do mais novo ao mais velho. |
| `PATCH /api/clubes/:id` 🔒 | `{bio}` (≤ 300; vazio apaga) | o mesmo objeto do `GET`. Só o técnico atual ou o admin (`403 NAO_E_TECNICO`, ex-técnico inclusive); `400` se > 300. |
| `PUT /api/clubes/:id/capa` 🔒 | multipart `capa` (JPEG ≤ 3 MB; o app manda 1500×500 comprimido) | o mesmo objeto do `GET`; apaga a capa antiga do disco. `IMAGEM_INVALIDA`, `413`, `403` como na bio. |

## 3. Posts, feed e galeria (Task 5) 🔒

| Rota | Corpo | Resposta |
|---|---|---|
| `POST /api/posts` | multipart com os campos `comoCbf` (opcional, `true`: **só o admin**, o post sai do clube `cbf`, e o admin não precisa de clube; qualquer outra pessoa recebe `403 NAO_E_ADMIN`), `legenda`, `prompts` (JSON `(string\|null)[]`), `cheia` e `mini`: cada arquivo vai como uma repetição do campo (`cheia` repetido 1–10 vezes, `mini` idem, **na mesma ordem**); o `[]` que aparece em outros pontos é só notação de lista, o nome do campo é `cheia`/`mini` sem colchetes (1–10 pares). **Post só de texto:** 0 arquivos e o campo `texto` (1–500 caracteres, sem espaços nas pontas); com imagens, `texto` não é aceito. **Post de vídeo:** o campo `video` (1 arquivo, ≤ 60 MB, ≤ 30 s) no lugar de `cheia`/`mini`, com `legenda` opcional; imagens **e** vídeo juntos, ou `texto` com vídeo → `400 DADOS_INVALIDOS`. O back converte para MP4 H.264 + AAC (lado maior 1280, `+faststart`) e gera a capa JPG do 1º segundo; o original é apagado. `400 VIDEO_LONGO` (acima de 30 s, medido pelo `ffprobe`, com 0,5 s de folga), `422 VIDEO_INVALIDO` (não é vídeo, ou a conversão falhou ou passou de 90 s), `413` (> 60 MB). Em qualquer erro nada fica no disco. Imagem acima de 3 MB segue `413` | `201 Post`. Sem arquivos e sem `texto` válido → `400 DADOS_INVALIDOS`. `SEM_CLUBE`, `IMAGEM_INVALIDA`, `413` se > 3 MB, `400` se > 10 imagens ou `cheia` e `mini` com tamanhos diferentes. Nada é gravado em disco se algum arquivo for inválido. Emite `posts.criado`. |
| `GET /api/posts?antes=&clube=&tag=` | — | `Pagina<Post>`, 12 por página, do mais novo ao mais velho. Sem `antes` e sem `clube` (1ª página do feed geral) vem também `fixados: Post[]` (por `pinnedAt` desc, máx. 3); sem `clube`, fixados nunca entram em `itens`. Com `tag=contratacao`: mesma resposta, só posts com `#contratacao` na legenda ou no texto (sem acento nem maiúsculas, palavra inteira; `#` dentro de URL ou colado em palavra não conta), sem `fixados`. |
| `GET /api/posts/:id` | — | `Post` |
| `PATCH /api/posts/:id` | `{legenda?, texto?, prompts?}` (`prompts` na ordem das imagens). `texto` (1–500, sem espaços nas pontas) só vale em post sem imagens; em post com imagens → `400 DADOS_INVALIDOS`. Em post sem imagens, `legenda` e `prompts` também dão `400 DADOS_INVALIDOS` (só o `texto` é editável) | `Post` · `NAO_E_TECNICO` (mesmas permissões: técnico atual ou admin) |
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
| `GET /api/posts/:id/reacoes` | — | `[{emoji, usuarios: [{id, nome, avatarUrl\|null, clube: {id,nome,escudoUrl}\|null}]}]`: quem reagiu, por emoji, o mais usado primeiro (empate por emoji). Mesma visibilidade do post: oculto → `404` (menos para o admin), id inexistente ou inválido → `404`. Nunca traz e-mail. |
| `PUT /api/posts/:id/curtida` | — | `204`. Apelido de `PUT .../reacao {emoji:'❤️'}` (compatibilidade com o app antigo). |
| `DELETE /api/posts/:id/curtida` | — | `204` (idempotente). Apelido de `DELETE .../reacao`. |
| `GET /api/posts/:id/comentarios` | — | `[{id, texto, mencoes: [{id, nome}], criadoEm, usuario: {id, nome, avatarUrl\|null, clube: {id,nome}\|null}}]`, do mais velho ao mais novo. `clube` é o atual de quem comentou. |
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

## 4b. Liga: tabela, rodadas e jogos (Task B1) 🔒

Pontos corridos com os 20 clubes, 38 rodadas (já criadas, abertas). A tabela é **calculada** a cada pedido, só com jogos de rodadas **fechadas**: vitória 3, empate 1; desempate por vitórias, saldo, gols pró e nome. A CBF não entra.

| Rota | Corpo | Resposta |
|---|---|---|
| `GET /api/liga/tabela` | — | `Linha[]` por posição: `{clubeId, nome, posicao, P, J, V, E, D, GP, GC, SG, ultimos}`. `ultimos`: até 5 resultados `'V'\|'E'\|'D'`, do jogo mais recente (maior número de rodada) ao mais antigo. |
| `GET /api/liga/rodadas` | — | `[{numero, fechada, resumoPublicado, resumoPostId: string\|null, prazoPalpite: ISO\|null, jogos: [{id, mandante: {id,nome,escudoUrl}, visitante, golsMandante, golsVisitante}]}]`, 38 itens. |
| `PUT /api/admin/rodadas/:n/jogos` 👑 | `{jogos: [{mandanteId, visitanteId, golsMandante, golsVisitante}]}` (até 10) | `204`. **Substitui todos** os jogos da rodada `n` (lista vazia limpa). Só com a rodada aberta (`409 RODADA_FECHADA`). `400 DADOS_INVALIDOS` e nada gravado se: clube em 2 jogos da mesma rodada (inclui jogo repetido), clube contra si mesmo, clube inexistente ou a CBF, placar fora de 0–99 ou não inteiro, ou só um dos lados nulo. **Jogo agendado:** `golsMandante` e `golsVisitante` `null` (ou ausentes) nos dois lados; ele aparece em `/liga/rodadas` com gols `null`, **não conta na tabela** e impede o fechamento da rodada. `404` para `n` fora de 1–38. |
| `POST /api/admin/rodadas/:n/fechar` 👑 | — | `204`; passa a contar na tabela. `409 RODADA_FECHADA` se já fechada. `409 PLACAR_PENDENTE` se algum jogo da rodada está sem placar (a rodada continua aberta). Emite `liga.rodadaFechada(n)`. |
| `POST /api/admin/rodadas/:n/reabrir` 👑 | — | `204`; sai da tabela até fechar de novo (o post do bot que já saiu não muda). `409 RODADA_ABERTA` se já aberta. |

### Bot da zoeira (Task B2) 👑

Só frases prontas (`back/src/bot/frases.ts`, listadas em `docs/bot-frases.md`).

| Rota | Corpo | Resposta |
|---|---|---|
| `POST /api/admin/rodadas/:n/previa` 👑 | — | `201 {texto, citados}`. `texto`: 3 a 6 frases, uma por linha, até 500 caracteres; `citados`: ids dos técnicos que aparecem pelo nome. Não grava nada; chamar de novo sorteia de novo. `409 RODADA_ABERTA` se a rodada não está fechada, `404` para `n` fora de 1–38. |
| `POST /api/admin/rodadas/:n/publicar` 👑 | `{texto, citados?}`: `texto` 1–500 (o admin pode ter editado); `citados`: os ids que a prévia devolveu | `201 Post`: post de texto do clube `cbf`, autor = o admin. **Push:** todos (menos o admin e os citados) recebem `CBF` / `Saiu o resumo da rodada N`, sem o nome do admin; os citados recebem só `A CBF citou você`. Vale como citado o id que é técnico de clube que jogou a rodada **e** cujo nome ainda aparece, como palavra inteira, no texto final; sem `citados`, ninguém é citado. `400` se o texto for inválido ou `citados` não for lista, `409 RODADA_ABERTA`. Não emite `posts.criado` (o push é este). **Um resumo por rodada:** publicar de novo → `409 RESUMO_JA_PUBLICADO` (reabrir a rodada não libera; apagar o post do resumo, sim). `GET /api/liga/rodadas` traz `resumoPublicado` (boolean) e `resumoPostId` (id do post, para linkar `/p/:id`; `null` se não publicado). O corpo do 409 não traz o id: use o da lista. |

### Calendário e prazo de palpite (Pack 3 · A1, IM-53) 🔒

| Rota | Corpo | Resposta |
|---|---|---|
| `PUT /api/admin/rodadas/:n/prazo` 👑 | `{prazoPalpite: ISO\|null}` | `204`. `null` tira o prazo (sem prazo não dá para palpitar). `400` se não for data ISO nem `null`; `404` para `n` fora de 1–38. Vale com a rodada aberta ou fechada. |
| `GET /api/liga/calendario` | — | Próximos jogos **sem placar**: Brasileirão de rodada aberta + Copa de fase aberta. `[{tipo: 'BRASILEIRAO'\|'COPA', id, rodada: number\|null, fase: {id,nome}\|null, prazoPalpite: ISO\|null, mandante: {id,nome,escudoUrl}, visitante}]`. Ordem: prazo mais próximo primeiro (sem prazo por último), depois rodada/ordem da fase. `id` é o do `Jogo` ou do `CopaJogo`. |

### Copa do Brasil (Pack 3 · A1, IM-53) 🔒

Mata-mata de **jogo único**; as fases (ex.: "Oitavas") e os confrontos são lançados pelo admin. A CBF não entra; cada clube aparece **no máximo uma vez por fase**; um clube que **perdeu** um jogo (placar, ou pênaltis no empate) não pode estar numa fase de `ordem` maior (`409 CLUBE_ELIMINADO`; vale nos dois sentidos, então mudar um placar que eliminaria quem já joga adiante também dá 409). O vencedor é **calculado** (placar; no empate, pênaltis), nada fica guardado.

Placar: `golsMandante`/`golsVisitante` de 0 a 99, ou `null` nos dois (agendado). Se o jogo termina **empatado**, `penaltisMandante`/`penaltisVisitante` (0–99, não podem empatar) são obrigatórios; fora disso devem ser `null`/ausentes. Qualquer violação → `400 DADOS_INVALIDOS`.

| Rota | Corpo | Resposta |
|---|---|---|
| `GET /api/copa` | — | `[{fase: {id,nome,ordem,prazoPalpite,fechada,resumoPublicado: boolean,resumoPostId}, jogos: [{id, mandante: ClubeMini, visitante, golsMandante, golsVisitante, penaltisMandante, penaltisVisitante, vencedor: ClubeMini\|null}]}]`, fases por `ordem`. `vencedor` é `null` sem placar. |
| `POST /api/admin/copa/fases` 👑 | `{nome, ordem}`: nome 1–60, ordem inteira 1–99 | `201 {id, nome, ordem}`. `409 ORDEM_REPETIDA`. |
| `PUT /api/admin/copa/fases/:id/jogos` 👑 | `{jogos: [{mandanteId, visitanteId, golsMandante, golsVisitante, penaltisMandante, penaltisVisitante}]}` (até 10) | `204`. **Substitui todos** os jogos da fase (lista vazia limpa). Só com a fase aberta (`409 FASE_FECHADA`: placar de fase fechada não muda). `400` (clube inexistente ou a CBF, clube duas vezes, contra si mesmo, placar/pênaltis inválidos, nada gravado), `409 CLUBE_ELIMINADO`, `404` fase inexistente. |
| `PUT /api/admin/copa/fases/:id/prazo` 👑 | `{prazoPalpite: ISO\|null}` | `204`. `400`/`404` como o da rodada. |
| `POST /api/admin/copa/fases/:id/fechar` 👑 | — | `201 {texto, citados}`: **fecha** a fase e devolve a prévia do resumo do bot (mesmo formato da prévia da rodada, frases de mata-mata em `docs/bot-frases.md`; não publica). `409 PLACAR_PENDENTE` se não houver jogos ou faltar placar/pênaltis (continua aberta), `409 FASE_FECHADA`. |
| `POST /api/admin/copa/fases/:id/previa` 👑 | — | `201 {texto, citados}`: gera a prévia do resumo **de novo** (outro sorteio) para fase **já fechada**, publicada ou não (como `POST /admin/rodadas/:n/previa`). Não grava nada. `409 FASE_ABERTA`, `404`. |
| `POST /api/admin/copa/fases/:id/reabrir` 👑 | — | `204`. `409 FASE_ABERTA`. |
| `POST /api/admin/copa/fases/:id/publicar` 👑 | `{texto, citados?}` (igual ao da rodada) | `201 Post` da CBF; push `CBF` / `Saiu o resumo da fase <nome>` para todos (menos admin e citados), `A CBF citou você` para os citados. **Um resumo por fase:** o segundo → `409 RESUMO_JA_PUBLICADO` (apagar o post libera). `409 FASE_ABERTA` se a fase não foi fechada. |

### Bolão (Pack 3 · A2, IM-54) 🔒

Palpite de placar nos jogos do Brasileirão e da Copa. Os **pontos são calculados** a cada pedido (nada é guardado): placar exato **3**; vencedor ou empate certo **1**; errado 0; na Copa, **+1** por acertar quem passa. Mudar o placar do jogo recalcula tudo. Lançar o resultado com `PUT .../jogos` mantém os palpites (mesmo confronto = mesmo jogo); trocar o confronto apaga os palpites daquele jogo.

**Prazo:** `Rodada.prazoPalpite`/`CopaFase.prazoPalpite`. Sem prazo, ou depois dele, não dá para palpitar (`409 PRAZO_ENCERRADO`). Antes do prazo cada pessoa só vê o próprio palpite; depois, os de todos.

| Rota | Corpo | Resposta |
|---|---|---|
| `PUT /api/bolao/palpites` | lista (1–50) de `{jogoId \| copaJogoId, golsMandante, golsVisitante, classificadoId?}` | `204`. **Lote atômico** (grava ou nada), regrava quem já palpitou. `jogoId` = `Jogo` do Brasileirão; `copaJogoId` = `CopaJogo` (exatamente um dos dois). Placar 0–99. **Copa:** palpite de **empate** exige `classificadoId` (um dos dois clubes); palpite com vencedor não precisa (sai do placar; se vier, tem de bater). `classificadoId` em jogo do Brasileirão → `400`. `400 DADOS_INVALIDOS`, `404` jogo inexistente, `409 PRAZO_ENCERRADO` se **qualquer** alvo estiver fora do prazo, já tiver placar ou estiver em rodada/fase fechada (nenhum é gravado). |
| `GET /api/bolao/meus?rodada=N` ou `?fase=id` | — | Meus palpites do escopo: `[{jogoId, copaJogoId, golsMandante, golsVisitante, classificadoId, pontos: number\|null, exato: boolean}]`. `pontos` é `null` enquanto o jogo não tem placar. `400` se não vier exatamente um dos dois. |
| `GET /api/bolao/jogo/:tipo/:id` | — | `:tipo` = `brasileirao` ou `copa`. `[{usuario: {id,nome,avatarUrl}, golsMandante, golsVisitante, classificadoId, pontos, exato}]`: **só o meu** (lista vazia se não palpitei) antes do prazo ou sem prazo; **de todos** depois do prazo. `404` tipo/jogo inexistente. |
| `GET /api/bolao/ranking` | — | `[{usuario: {id,nome,avatarUrl}, pontos, exatos, posicao}]` por `posicao` (1, 2, 3…): soma de tudo (Brasileirão + Copa), desempate por **placares exatos** e depois por nome. Só aparece quem já palpitou. |

O resumo da CBF (prévia da rodada e `fechar` da fase) ganha, ao fim, a linha do **rei do bolão** daquela rodada/fase (quem mais pontuou, se alguém pontuou).

**Lembrete:** push `Bolão` / `<Rodada N ou fase>: faltam palpites, o prazo acaba em 2 h`, enviado **uma vez** por prazo (se o prazo mudar, vale de novo) a quem ainda não palpitou todos os jogos daquele prazo. Roda a cada minuto no próprio back.

### Preferências de push (Pack 3 · A2, IM-54) 🔒

`PATCH /api/me {pushPrefs: {posts?, comentarios?, mencoes?, cbf?, bolao?, trocas?}}` (booleanos; chave desconhecida ou valor não booleano → `400`). Só as chaves enviadas mudam. `GET /api/me` e as respostas do `PATCH` trazem `pushPrefs` com as **6 chaves** (`true` por padrão). `pushEnabled: false` continua desligando tudo.

Cada push respeita a sua chave: `posts` (post novo de clube), `comentarios` (comentário no seu clube), `mencoes`, `cbf` (post da CBF e "A CBF citou você"), `bolao` (lembrete), `trocas` (pedido de troca para o admin e a decisão para quem pediu).

## 4c. Votações e selos (Task B2) 🔒

`Votacao = {id, titulo, tipo: 'CLUBE'\|'TECNICO'\|'POST', prazo, aberta, encerrada, opcoes: [{id, rotulo}], meuVoto: string\|null, resultado?: [{opcao, rotulo, votos}]}`. As opções são ids: de clube (`CLUBE`, nunca a CBF), de técnico atual (`TECNICO`, id do usuário) ou de post visível (`POST`). `aberta` = não encerrada e dentro do prazo. **O voto é secreto:** `resultado` (do mais votado ao menos, empate na ordem das opções) só vem **depois de encerrada**; antes disso nenhuma contagem sai da API, nem para o admin.

| Rota | Corpo | Resposta |
|---|---|---|
| `POST /api/admin/votacoes` 👑 | `{titulo (1–100), tipo, opcoes: string[] (2–10, sem repetir), prazo (ISO, futuro)}` | `201 Votacao`. `400 DADOS_INVALIDOS` para qualquer campo fora disso ou opção inexistente. |
| `POST /api/admin/votacoes/:id/encerrar` 👑 | — | `201 Votacao` com `resultado`. Dá o **selo** ao clube com mais votos (`CLUBE`: o clube; `TECNICO`: o clube que a pessoa comanda hoje; `POST`: o clube do post); **empate = selo para todos os empatados; sem votos = sem selo**. Publica o resultado como post de texto da CBF. Pode encerrar antes do prazo. `409 VOTACAO_ENCERRADA` se já encerrada. |
| `GET /api/votacoes` | — | `Votacao[]` das **não encerradas** (por prazo), com `meuVoto`; as que passaram do prazo e ainda esperam o admin vêm com `aberta: false`. Sem `resultado`. Com `?encerradas=1`: só as **encerradas** (as 50 mais recentes, da mais nova à mais velha), cada `Votacao` com `resultado` e mais `encerradaEm` e `vencedor` (rótulo; empate: rótulos juntos por " e "; sem votos: `null`). |
| `GET /api/votacoes/:id` | — | `Votacao`; `resultado` só se encerrada. `404` se não existe. |
| `POST /api/votacoes/:id/voto` | `{opcao}` | `204`. `409 JA_VOTOU` (1 voto por pessoa, garantido por chave no banco), `409 VOTACAO_ENCERRADA` (prazo vencido ou encerrada), `400 DADOS_INVALIDOS` se `opcao` não é uma das opções. |

## 4d. Prévia do WhatsApp e erros do app (Task B3)

| Rota | Corpo | Resposta |
|---|---|---|
| `GET /api/og/p/:id` (pública) | — | `200 text/html` com `og:title` (`"<Clube> no InstaManager"`), `og:description` (legenda ou texto, espaços normalizados, até 150 caracteres), `og:image` (URL **absoluta**, `APP_URL` + a **mini** da 1ª imagem; post de texto usa `/icones/icon-512.png`), `og:url`, `twitter:card summary_large_image` e `<meta http-equiv="refresh" content="0;url=/p/:id">`. Tudo escapado (`& < > " '`). Post oculto, inexistente, id inválido ou qualquer erro → **200 com a prévia genérica** (título `InstaManager`), nunca 404/500 e sem dado do post. Quem chama é o nginx. |
| `POST /api/erros-front` (pública) | `{mensagem, url, versao, pilha?}` (texto) | `204`. Grava **uma linha** no log do back (`erro-front {json}`, com `userId` se houver sessão, nunca e-mail ou nome; `mensagem` corta em 500, `pilha` 2000, `url` 300, `versao` 40). Corpo **≤ 4 KB** (`413 CORPO_GRANDE`, decidido pelo `Content-Length`; sem ele, também 413). Limite de **30 por minuto por IP** (`429 MUITAS_TENTATIVAS` + `Retry-After`). `400 DADOS_INVALIDOS` se faltar `mensagem`/`url`/`versao` ou o tipo estiver errado. Exige `Origin` como as outras rotas que mudam estado. |

**nginx (`front/nginx.conf`):** `map $http_user_agent $robo_previa` marca `WhatsApp`, `facebookexternalhit`, `Twitterbot`, `TelegramBot`, `Slackbot`, `Discordbot` e `LinkedInBot`. Em `/p/<uuid>`, robô é reescrito para `/api/og/p/<uuid>`; qualquer outro cliente recebe o `index.html` do app. Só o caminho exato `/p/<uuid>` (36 caracteres) entra nessa regra.

## 4e. Atividade e @menções (Task C1) 🔒

**Menção:** guardada no texto (legenda, texto do post, comentário) como `@[Nome](uuid)`. O back só considera o formato com uuid de usuário que existe (o resto é texto comum) e no máximo as **10** primeiras. `mencoes` em `Post` e no comentário traz `[{id, nome}]` com o **nome de hoje, do banco** (o nome escrito no texto não vale); o front troca a marca pelo chip. Quem é mencionado recebe push `<nome> mencionou você` → `/p/<id>` e um item `MENCAO`, **uma vez por texto**: editar a legenda/texto mantendo a menção não repete, menção nova avisa só a nova. Ninguém é avisado da própria ação (nem se mencionar). No comentário, o técnico do clube já ganha `COMENTARIO` (e o push de comentário), então não ganha também `MENCAO` do mesmo comentário.

| Rota | Corpo | Resposta |
|---|---|---|
| `GET /api/atividade?antes=` | — | `{itens, proximo}`, 20 por página, do mais novo ao mais velho (cursor como o do feed; `400` se malformado). Item: `{id, tipo, criadoEm, lida, ator: {id, nome, avatarUrl\|null}\|null, post: {id, miniUrl\|null, resumo}\|null, votacao: {id, titulo}\|null, troca?: {status: 'APROVADA'\|'RECUSADA', clube: ClubeMini\|null}\|null, comentario?: {id, resumo}\|null, conquista?: {tipo, nome}}` (`conquista` só nos itens `CONQUISTA`; `comentario` só nos itens `COMENTARIO` e `MENCAO`: `resumo` ≤ 80 caracteres do **comentário**, com a menção como `@Nome` do banco; `null` na menção feita em post; comentário ocultado pelo admin ou post indisponível → `resumo: "Comentário indisponível"`. `troca` só nos itens `TROCA_DECIDIDA`: `clube` é o que a pessoa pediu para assumir, `null` no pedido de sair). `resumo` ≤ 80 caracteres (menção vira `@Nome`). Post oculto pelo admin (para quem não é admin) → `{id, miniUrl: null, resumo: "Post indisponível"}`; post apagado → o item some. |
| `GET /api/atividade/nao-lidas` | — | `{total}` |
| `POST /api/atividade/lidas` | — | `204`: marca todas como lidas. |
| `GET /api/pessoas?q=` | — | até **8** `[{id, nome, avatarUrl\|null, clube: ClubeMini\|null}]` para o autocompletar do `@`: pedaço do nome, sem acento e sem diferenciar maiúsculas (quem começa com o texto vem primeiro); `%` e `_` valem como texto. `q` com menos de 2 caracteres (após `trim`, cortado em 60) → `[]`, não `400`. Sem e-mail. |
| `GET /api/pessoas/:id?antes=` | — | Perfil público do técnico (Pack 3 · A3, IM-55): `{id, nome, avatarUrl\|null, clube: ClubeMini\|null, historico: [{clube: ClubeMini, inicio, fim\|null}], posts: Pagina<Post>, nivel: {xp, nome, min, proximo\|null}, conquistas: [{tipo, nome, vezes, ultimaEm}]}` (nível e conquistas: Pack 3 · B1, IM-61). `historico` do mais novo ao mais velho (o atual tem `fim: null`; torcedor sem passagem → `[]`). `posts`: os posts da pessoa, 12 por página (cursor `antes`, mesmo do feed), mais novos primeiro, **sem `fixados`**, com a mesma visibilidade do feed (oculto pelo admin só o admin vê; "ocultar para mim" some só para quem ocultou). **Posts da CBF não entram** (a CBF posta pelo admin sem mostrar o nome dele). **Sem e-mail** nem outro dado de conta. `404 NAO_ENCONTRADO` para id inexistente ou inválido. **`nivel`** é calculado na hora do histórico (sem tabela de XP): `xp`, `nome` (Estagiário 0 · Auxiliar 100 · Técnico 300 · Professor 700 · Lenda 1500), `min` (XP em que o nível começa) e `proximo` (XP do próximo nível, `null` na Lenda). XP: postar 5 (post não oculto, de clube não oficial); reação recebida 1 (até 50 por post, sem a do autor); vencer jogo 10; empatar 3; placar exato no bolão 5; selo do clube 20. O resultado de um clube é do técnico que o comandava no `fechadaEm` da rodada/fase (do selo, no `createdAt`); rodada ou fase reaberta não conta; na Copa, empate com decisão nos pênaltis vale empate (3) para os dois. **`conquistas`**: uma entrada por tipo, a mais recente primeiro: `tipo` (`PRIMEIRA_VITORIA`, `GOLEADA`, `INVICTO_5`, `LIDER`, `CAMPEAO_COPA`, `REI_BOLAO`, `PRIMEIRO_STORY`, `COMUNICADOR`), `nome` ("Primeira vitória", "Goleada", "Invicto", "Líder", "Campeão da Copa", "Rei do bolão", "Primeiro story", "Comunicador"), `vezes` (só o `REI_BOLAO` passa de 1) e `ultimaEm`. Conquista dada não é retirada (nem se a rodada for reaberta). |

**Tipos e quem recebe** (o push continua igual; a atividade é o histórico):

- `REACAO`: o técnico atual do clube do post, quando outra pessoa reage. 1 item por pessoa por post: reagir de novo (trocar o emoji) troca o item e ele volta a não lido.
- `COMENTARIO`: o técnico atual do clube do post, quando outra pessoa comenta.
- `MENCAO`: a pessoa mencionada (post, edição ou comentário).
- `CBF_CITOU`: os técnicos citados no resumo da rodada (`ator: null`, `post` = o resumo).
- `TROCA_DECIDIDA`: quem pediu a troca, aprovada ou recusada (`ator: null`, `troca` com o resultado).
- `VOTACAO_RESULTADO`: todo mundo, menos o admin que encerrou (`ator: null`, `votacao` e `post` = o resultado).
- `CONQUISTA`: o técnico que ganhou uma conquista nova (`ator: null`, `conquista: {tipo, nome}`). Junto saem um push (chave `cbf`, abre `/u/:id`) e um post de texto da CBF: "🏆 @[Nome](id) conquistou *Nome da conquista*!". Na **primeira execução** (deploy; `Setting` `conquistas.semeadas`) o histórico é gravado **em silêncio**: sem atividade, push nem post.
- `RESPOSTA`: reservado para a resposta a comentário (IM-62); o valor já existe no enum.

Itens com mais de **60 dias** são apagados na limpeza (que roda no boot do back e depois a cada hora, junto com sessões e stories vencidos). Eventos novos: `reacoes.reagida(postId, userId)` e `posts.editado(postId)`. As conquistas escutam `liga.rodadaFechada`, `copa.faseFechada(faseId)`, `posts.criado`, `stories.criado(storyId)` e `votacoes.encerrada(votacaoId)` (os três últimos novos) e recalculam; duas execuções ao mesmo tempo não repetem a conquista (chave `userId+tipo+refId`).

## 4f. Busca (Task C2) 🔒

| Rota | Corpo | Resposta |
|---|---|---|
| `GET /api/busca?q=&tipo=&antes=` | — | `{itens, proximo}`, **20 por página**. `q`: 2 a 60 caracteres depois do `trim` (`400 DADOS_INVALIDOS` fora disso); `tipo`: `posts`, `prompts`, `clubes` ou `pessoas` (`400` se faltar ou for outro). Sem acento e sem diferenciar maiúsculas; `%`, `_` e `\` valem como texto; sempre parametrizada (aspas e `'; drop` não dão erro, só não acham nada). |

Itens por `tipo`:

- `posts`: `Post` (legenda **e** texto; o markup `@[Nome](uuid)` não conta, e quem foi mencionado é achado pelo nome de hoje), mais novo primeiro, com a mesma visibilidade do feed (oculto pelo admin só o admin acha; "ocultar para mim" some para quem ocultou).
- `prompts`: item da galeria (`{imagemId, postId, miniUrl, cheiaUrl, prompt, clube, favorito}`), só de post visível.
- `clubes`: `{id, nome, escudoUrl, tecnico: {id, nome}|null}` por nome; **nunca a CBF**.
- `pessoas`: `{id, nome, avatarUrl|null, clube: ClubeMini|null}`, quem começa com o texto vem primeiro, depois por nome. Sem e-mail.

`antes`: em `posts` e `prompts` é o cursor do feed (`400` se malformado); em `clubes` e `pessoas` é a posição (número) devolvida em `proximo`. `proximo` é `null` na última página.

## 4g. Stories e vídeo (Task C3) 🔒

Story: imagem ou vídeo curto do clube, some em **24 h**. Só o técnico atual posta pelo seu clube; o admin posta como CBF (`comoCbf=true`). Vídeo (story ou post): ≤ 60 MB de envio, ≤ 30 s, convertido no back com **ffmpeg** para MP4 H.264 + AAC, lado maior 1280, `+faststart`, com capa JPG; a conversão acontece dentro do pedido (limite de 90 s). Arquivos em `/uploads/stories/` e `/uploads/videos/`.

| Rota | Corpo | Resposta |
|---|---|---|
| `POST /api/stories` | multipart: **ou** `imagem` (JPEG ≤ 3 MB) **ou** `video`, mais `comoCbf` (opcional, `true`: só o admin) | `201 {id, tipo: 'IMAGEM'\|'VIDEO', url, capaUrl\|null, criadoEm, visto: false, expiraEm, clube: ClubeMini}`. `403 SEM_CLUBE` (quem não tem clube, inclusive o admin sem `comoCbf`), `403 NAO_E_ADMIN`, `400 DADOS_INVALIDOS` (nenhum arquivo ou os dois), `400 IMAGEM_INVALIDA`, `400 VIDEO_LONGO`, `422 VIDEO_INVALIDO`, `413` (> 3 MB a imagem, > 60 MB o vídeo). Nada fica no disco em caso de erro. |
| `GET /api/stories` | — | `[{clube: ClubeMini, stories: [{id, tipo, url, capaUrl\|null, criadoEm, visto}], todosVistos}]`: só os não expirados, **uma bolinha por clube** (a CBF inclusive). Ordem: as com story não visto primeiro, e dentro de cada grupo a do story mais novo primeiro. Dentro do clube, `stories` vai do mais velho ao mais novo. `visto` é de quem pede. |
| `PUT /api/stories/:id/visto` | — | `204` (repetir não muda nada). `404` se não existe ou expirou. |
| `GET /api/stories/:id/vistos` | — | `[{id, nome}]` de quem viu (sem o autor), do mais recente ao mais antigo. Só o autor do story ou o admin (`403 NAO_E_AUTOR`); `404` se expirou. |
| `DELETE /api/stories/:id` | — | `204`: apaga a linha e os arquivos. O autor, o técnico atual do clube ou o admin (`403 NAO_E_AUTOR`); `404` se expirou. |

Story expirado não aparece em lista nenhuma e responde `404` em tudo; a limpeza horária apaga a linha e os arquivos (mp4, capa, imagem). O post de vídeo não entra na galeria (ela só lista imagens com prompt). **nginx:** `client_max_body_size 64m` e `proxy_read_timeout 120s` só em `/api/stories` e `POST /api/posts`; nas demais rotas o limite continua o de antes.

## 5. Push (Task 7) 🔒

| Rota | Corpo | Resposta |
|---|---|---|
| `GET /api/push/chave` | — | `{chave}` (VAPID pública) · `503 PUSH_INDISPONIVEL` se o servidor não tem VAPID |
| `POST /api/push/inscricao` | `{endpoint, keys: {p256dh, auth}}` | `204` (upsert por endpoint; se outra pessoa entrar no mesmo aparelho, a inscrição passa para ela). `400` se o endpoint não for `https` de um serviço de push conhecido (`fcm.googleapis.com`, `*.push.services.mozilla.com`, `web.push.apple.com`, `*.notify.windows.com`, sem porta nem usuário), porque o servidor faz POST nele. **O front chama `DELETE /api/push/inscricao` antes de `POST /auth/sair`** (senão o aparelho segue recebendo push de quem saiu); redefinir a senha apaga todas as inscrições da conta. |
| `DELETE /api/push/inscricao` | `{endpoint}` | `204` (só apaga a inscrição da própria pessoa) |

Ligar/desligar: `PATCH /api/me {pushEnabled}`. Mensagens (`titulo` / `corpo` → `url`): post novo `"<Clube>"` / `"<técnico> postou"` → `/p/<id>` (post da CBF: `"CBF"` / `"Novo comunicado da CBF"`, sem o nome do admin); comentário `"Novo comentário"` / `"<nome>: <80 chars>"` → `/p/<id>`; pedido de troca (só para admins, menos quem pediu) `"Pedido de troca"` → `/admin`; decisão `"Troca aprovada"` ou `"Troca recusada"` → `/perfil`. Inscrição que responde 404/410 é apagada.

## 6. Modelo de dados

Ver `back/prisma/schema.prisma`: `User`, `Session`, `PasswordReset`, `Club` (`coachId @unique`, `oficial`: a CBF), `Rodada`, `Jogo`, `Votacao`, `Voto` (`@@id([votacaoId, userId])`), `Selo`, `CoachTenure`, `Post`, `PostImage`, `Like`, `Comment`, `Notificacao`, `Story`, `StoryVisto`, `PostVideo`, `TransferRequest`, `PushSubscription`, `Setting`. Apagar `Post` apaga `PostImage`, `Like` e `Comment`. `/health` fica fora do contrato (`GET /api/health`).

## 7. Variáveis de ambiente

`DATABASE_URL`, `APP_URL`, `INVITE_CODE` (valor inicial do convite, só no seed), `ADMIN_EMAIL`, `UPLOADS_DIR`, `RESEND_API_KEY`, `MAIL_FROM`, `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`/`VAPID_SUBJECT` (Task 7).

Em produção, atrás do Traefik/nginx: `TRUST_PROXY=1` (sem isso o rate limit enxerga o IP do proxy e conta todo mundo junto).
