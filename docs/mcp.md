# CBF via MCP

O app tem um servidor MCP para o Fabio operar a CBF pelo Claude Code: ler posts, comentários, tabela, calendário, bolão e votações, e publicar como CBF.

## Conectar

```
claude mcp add --transport http cbf https://instamanager.fj-dev.tech/mcp --header "Authorization: Bearer $CHAVE"
```

Em desenvolvimento, troque a URL por `http://localhost:3000/mcp`.

## Gerar e trocar a chave

1. Gere: `openssl rand -hex 32`.
2. Coloque em `MCP_CHAVE=` no `.env` do servidor (na VPS, é ação do Fabio) e reinicie o back.
3. Para trocar, gere outra, atualize o `.env`, reinicie o back e refaça o `claude mcp add` com a chave nova. A antiga para de valer na hora.
4. `MCP_CHAVE` vazia = MCP desligado (`/mcp` responde `404`). Nunca coloque a chave no repo.

## Ferramentas

Leitura (sem efeito colateral):

| Ferramenta | Entrada |
|---|---|
| `ultimos_posts` | `limite?` 1–30 (10) |
| `ultimos_comentarios` | `limite?` 1–50 (20) |
| `tabela`, `calendario`, `bolao_ranking`, `votacoes` | — |

Escrita (como CBF, menos `postar_no_clube`; cada chamada vira uma linha no log, aba **MCP** do admin):

| Ferramenta | Entrada |
|---|---|
| `criar_post` | `texto` (até 500), com o aviso normal |
| `criar_story` | `texto` (até 200, 8 linhas), `fundo?` |
| `postar_no_clube` | `legenda`, e **ou** `imagens: [{cheia, mini}]` (1–10, JPEG em base64) **ou** `video` (MP4 em base64). Publica no clube do admin (o técnico logado no app); admin sem clube ou com a CBF dá `SEM_CLUBE`. A `mini` tem 400 px no lado maior, e a falta dela dá o mesmo `400` do post normal |
| `criar_votacao` | `titulo`, `tipo`, `opcoes`, `prazo` |
| `lancar_placares` | `rodada`, `placares: [{mandanteId, visitanteId, golsMandante, golsVisitante}]` |
| `lancar_placares_copa` | `faseId`, `placares` (com `penaltisMandante?`/`penaltisVisitante?`) |

`lancar_placares*` troca só os jogos informados e deixa os outros como estão. Jogo que não existe na rodada ou rodada fechada dá erro e não grava nada. **Fechar rodada ou fase não é possível por aqui**: continua no admin.

O corpo do `/mcp` aceita até **64 MB** (o `/api` segue com 1 MB; acima disso, `413`). O base64 aumenta o arquivo em 4/3, então o vídeo cru cabe até ~48 MB (um vídeo de 30 s em 4:5 e sem áudio fica bem abaixo disso). O log do admin guarda só `{legenda, imagens: N}` ou `{legenda, video: true}`, nunca o base64.

Erros voltam como resultado da ferramenta (`isError`), no formato `CODIGO: mensagem`.
