# Assessoria do Botafogo: plano

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> Fluxo do Maestri: um card por task (IM-72 em diante) e um andar por task. Cada task passa por dev → VAR → QA → merge. Antes do deploy: backup e Safari no CI. **Um `pnpm install` por vez** (store `pnpm-store-im6`). Se o `node_modules` vier corrompido, avise o Maestro em vez de insistir.

**Goal:** Um terminal do Botafogo que transforma prints do OSM em posts no estilo do @botafogo (arte + legenda) e publica no perfil do clube na liga.

**Architecture:**
- **App:**
  - ferramenta MCP nova `postar_no_clube`, que usa o mesmo `PostsService.criar`;
  - o feed mostra vídeo em 4:5.
- **`assessoria/`:** uma pasta fora do build e do deploy, com:
  - modelos HTML/CSS;
  - um script Node (sem dependência nova) que preenche o modelo e tira a "foto" com o `google-chrome --headless` instalado;
  - o ffmpeg, para as miniaturas e os vídeos.
- **Terminal:** papel novo no Maestri.

**Tech Stack:** a mesma. Nenhuma dependência nova. Entram fontes OFL (arquivos) em `assessoria/fontes/`.

**Spec:** `docs/superpowers/specs/2026-11-05-assessoria-botafogo-design.md`.

## Global Constraints

- **Imagem:** JPEG 1080×1350. **Vídeo:** MP4 H.264 em 4:5 (1080×1350), com até 30 s e sem áudio.
- **`postar_no_clube {legenda, imagens?: [{cheia, mini}] (1–10, JPEG em base64), video?: string (MP4 em base64)}`:**
  - só imagens **ou** só vídeo;
  - publica no clube do **admin** (o primeiro `isAdmin`, como nas outras ferramentas). Sem clube, ou com a CBF, dá `isError` `SEM_CLUBE`;
  - o post sai como post normal do clube, com push normal, conquistas e XP;
  - a `mini` é feita pelo `assessoria/` (ffmpeg, 400 px no lado maior). O back não muda o `PostsService`.
  - O `McpAcao` grava `{legenda, imagens: N}` ou `{legenda, video: true}`, **nunca o base64**. Resumo: `"post do clube: '<legenda…>' · N imagens"`.
- **Corpo do `/mcp`:** **64 MB**, só nessa rota (o `/api` continua com 1 MB). O nginx em `location = /mcp` fica com `client_max_body_size 64m` e `proxy_read_timeout 150s`, igual ao bloco do upload.
- **Feed:** `.video-card` passa de `aspect-ratio: 1 / 1` para **4 / 5**, sempre com `object-fit: cover`. Vale para todos os vídeos.
- **`assessoria/`, no `.gitignore`:** `assessoria/fotos/`, `assessoria/referencias/` e `assessoria/saidas/`. **Não ficam no `.gitignore`** os modelos, os scripts, as fontes, `estadios.json` e `CLAUDE.md`.
- **Banco de fotos:**
  - `assessoria/fotos/indice.json` guarda `{ "<slug-do-jogador>": { arquivo, fonte, aprovadaEm } }`;
  - fotos genéricas ficam em `assessoria/fotos/genericas/` (torcida e estádio);
  - qualidade mínima: **1000 px no lado menor**.
- **Identidade visual:**
  - fundo preto e foto em preto e branco ou escurecida com degradê;
  - títulos numa serifada condensada de alto contraste e textos em sem serifa condensada (a Barlow Condensed que o app já tem serve);
  - escudos de `front/public/escudos/<id>.svg`;
  - a estrela solitária vem do escudo.

## Review Focus

1. **Mídia grande:** vídeo de 30 s ou 10 imagens em base64 passam pelo nginx e pelo back, e a conversão do vídeo cabe no timeout. Um corpo acima de 64 MB dá erro claro, e não 500. Teste na B1.
2. **`mini` faltando, ou em número diferente das `cheia`:** o mesmo `400` do post normal, como `isError`, e nada gravado. Teste na B1.
3. **Log do MCP sem base64:** a `entrada` gravada não pode ter mais que alguns KB. Teste na B1.
4. **Vídeo antigo em paisagem no feed 4:5:** continua aparecendo, cortado nas laterais como já era no quadrado, sem deformar. Teste na B2.
5. **Foto escura ou clara demais, ou nome muito longo** (ex.: "DANILO PEREIRA DOS SANTOS"): o texto da arte não pode sair da área nem ficar ilegível. O script reduz a letra até caber, como no story de texto. Teste na B3.

---

### Task B0: Referências · Maestro · IM-72
- [ ] Salvar em `assessoria/referencias/` os prints do portal: fim de jogo, nossos onze, próxima partida, quadros dos dois reels e nota oficial. Atualizar o `.gitignore`.
- [ ] Commit `chore: pasta da assessoria e gitignore [IM-72]`.

### Task B1: Back · `postar_no_clube` e corpo do `/mcp` · IM-73
**Files:**
- `back/src/mcp/ferramentas.ts`, `back/src/mcp/mcp.service.ts` e `back/src/mcp/mcp.controller.ts`, ou onde o body parser do `/mcp` for montado;
- `back/src/http.ts`, se precisar separar o limite;
- `front/nginx.conf` (`location = /mcp`, autorizado);
- `docs/mcp.md` e `docs/api.md`.

Test: `back/test/mcp.e2e-spec.ts`.

**Interfaces (Produces):** a ferramenta `postar_no_clube`, com a entrada das Global Constraints. O resultado é `{ id }` do post.

Passos:
- [ ] Testes:
  - post com 2 imagens (cheia e mini) aparece como post do clube do admin, com 2 `PostImage`;
  - post com vídeo (MP4 curto gerado no teste com o ffmpeg, como os testes de vídeo já fazem) cria um `PostVideo`;
  - imagens e vídeo juntos, ou mini faltando, dão `isError` e nada é gravado (Review Focus 2);
  - admin sem clube dá `isError SEM_CLUBE`;
  - `McpAcao.entrada` com menos de 2 KB e sem base64 (Review Focus 3);
  - corpo de cerca de 5 MB passa, e acima de 64 MB dá `413` (Review Focus 1);
  - `tools/list` com 12 ferramentas.
- [ ] `nginx -t` como no CI.
- [ ] Suíte inteira com saída 0, e uma segunda vez num banco novo (como na IM-69).
- [ ] Commit `feat: MCP posta no clube do admin [IM-73]`.

### Task B2: Front · vídeo em 4:5 no feed · IM-74
**Files:**
- o CSS de `.video-card`;
- `front/src/feed/VideoCard.tsx`, se precisar.

Test: no teste do `VideoCard`.

- [ ] Teste: o cartão de vídeo usa a proporção 4/5 e `object-fit: cover`. Confira o CSS aplicado ou a classe nova, como os testes de CSS do app já fazem.
- [ ] QA: no celular, um vídeo antigo em paisagem e um em retrato continuam bons (Review Focus 4).
- [ ] Commit `feat: vídeo em 4:5 no feed [IM-74]`.

### Task B3: Assessoria · modelos e gerador · IM-75
**Files** (todos novos, em `assessoria/`):
- `gerar.mjs`: o gerador, uma CLI;
- `modelos/<formato>.html`, mais um CSS comum;
- `fontes/`: fontes OFL com a licença;
- `estadios.json`: os 20 clubes → nome do estádio;
- `gerar.test.mjs`: testes com `node --test`;
- `README.md`: como usar.

**Interfaces (Produces):**
- **Comando:** `node assessoria/gerar.mjs <formato> <dados.json>` grava em `assessoria/saidas/<data>-<formato>/`:
  - `arte.jpg` (1080×1350) e `mini.jpg` (400 px no lado maior);
  - ou `video.mp4` (4:5, até 30 s, sem áudio) e `capa.jpg`.

  Ele imprime os caminhos em JSON.
- **Formatos e dados:**
  - `fim-de-jogo {mandante, visitante, golsMandante, golsVisitante, gols: [{minuto, jogador, clube}], foto}`;
  - `nossos-onze {adversario, titulares: [{numero, nome, capitao?}], tecnico, reservas: [{numero, nome}], foto}`;
  - `proxima-partida {competicao, rodadaOuFase, mandante, visitante, estadio?, dataHora, foto}`, com o estádio vindo de `estadios.json` pelo mandante quando faltar;
  - `proxima-partida-video` (os mesmos dados);
  - `contratacao-video {nome, idade, posicao, foto}`;
  - `coletiva {foto?}`, que usa a genérica da torcida;
  - `despedida {nome, foto}`.

  O campo `foto` é o caminho de uma imagem local. Os clubes vão por id do app (`botafogo`, `atletico-mg`…).
- **Vídeo:** a arte é renderizada em duas camadas, o fundo com a foto e os textos em PNG transparente (`--default-background-color=00000000`). O ffmpeg faz um `zoompan` lento no fundo e a entrada dos textos com fade/slide, com cerca de 8 s *(call)*.
- **Texto que não cabe:** o modelo diminui a letra por medida, já no Chrome, antes da captura (Review Focus 5).

Passos:
- [ ] Testes com `node --test`:
  - para cada formato, o HTML preenchido contém os dados, ou seja, o placar, os 11 nomes, o "VS" com os dois clubes, "OBRIGADO" e "COLETIVA";
  - campo obrigatório faltando dá um erro claro que cita o campo;
  - uma geração real de `fim-de-jogo` produz um JPEG de 1080×1350 (conferido com o `ffprobe`) e a mini;
  - uma geração real de `contratacao-video` produz um MP4 de 1080×1350 com até 30 s;
  - nome com 26 letras não transborda: o teste lê o tamanho da letra aplicado.
- [ ] O Maestro olha as artes de exemplo contra `assessoria/referencias/` e aprova a fidelidade ao @botafogo.
- [ ] Commit `feat: modelos e gerador da assessoria do Botafogo [IM-75]`.

### Task B4: Terminal da assessoria · Maestro · IM-76
- [ ] `assessoria/CLAUDE.md` com o fluxo:
  1. ler o print;
  2. conferir com o MCP (calendário, tabela, últimos posts);
  3. buscar 2–3 fotos (Wikimedia primeiro), mostrar com a fonte, o Fabio escolhe, gravar no banco;
  4. gerar;
  5. mostrar a arte e a legenda;
  6. postar com `postar_no_clube` só depois do OK.

  Regras: placar diferente do app → avisar e esperar, nunca lançar placar; foto com menos de 1000 px → descartar; tom das legendas no estilo @botafogo.
- [ ] Papel "Assessoria Botafogo" no Maestri e o terminal (Sonnet) na pasta do projeto, como o Tribuna.
- [ ] Teste de fumaça com o Fabio: um post de fim de jogo de verdade.

### Task B5: QA, backup e deploy · IM-77
- QA no celular de B2 e do post gerado pela B3 no feed: imagem e vídeo em 4:5.
- Backup e push com aprovação do Fabio. Depois, conferir que `tools/list` em produção traz 12 ferramentas.
