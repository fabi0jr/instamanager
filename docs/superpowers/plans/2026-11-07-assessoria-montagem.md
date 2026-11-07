# Assessoria do Botafogo: montagem com o Gemini (plano)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> Fluxo do Maestri: um card por task (IM-86 em diante) e um andar por task. Cada task passa por dev → VAR → QA → merge. **Não há deploy:** `assessoria/` fica fora do app.

**Goal:** O terminal Estrela Solitária gera montagens realistas, como "jogadores se abraçando com a camisa do Botafogo", a partir das fotos aprovadas, usando a API de imagem do Gemini. O Fabio escolhe uma das versões e ela vira post.

**Architecture:** Um script novo, `assessoria/montagem.mjs`, sem dependência npm (`fetch` do Node e ffmpeg), que:
1. reduz as fotos de referência;
2. chama a API Interactions do Gemini uma vez por versão;
3. grava as versões em 1080×1350 numa pasta de `saidas/`.

Um formato novo, `foto`, no `gerar.mjs`, transforma a versão escolhida em `arte.jpg` e `mini.jpg`, e o `postar.mjs` posta como já faz hoje.

**Tech Stack:** Node (`node --test`), ffmpeg e Gemini API (`POST https://generativelanguage.googleapis.com/v1beta/interactions`).

**Spec:** `docs/superpowers/specs/2026-11-05-assessoria-botafogo-design.md`, mais as decisões abaixo, que mudam a não-meta "não gera imagem com IA".

## Decisões (Fabio, 2026-11-07)
- **A assessoria pode gerar montagens com IA.** O app continua sem IA.
- **A IA é o Gemini, porque o Fabio já usa.**
- **O plano Plus do app Gemini não inclui a API.** A API é cobrada à parte, numa chave do Google AI Studio com faturamento ativo, e não tem cota grátis para imagem. O preço é de **US$ 0,0504 por imagem 2K** no `gemini-nano-banana-2.1`. Com 3 versões, cada montagem custa cerca de US$ 0,15.
- **O Fabio vê as versões e escolhe uma.** Nada é postado sem o OK dele, e uma montagem que ele não escolheu não vira foto aprovada.

## Global Constraints
- **Chave:** `GEMINI_API_KEY`, lida do ambiente ou do `.env` da raiz com `process.loadEnvFile`, como no `postar.mjs`. Ela nunca aparece em mensagem, log ou arquivo de saída.
- **Modelo:** vem de `GEMINI_MODELO_IMAGEM`. O padrão é `gemini-nano-banana-2.1`.
- **Requisição:**
  - cabeçalhos `x-goog-api-key`, `Content-Type: application/json` e `Api-Revision: 2026-05-20`;
  - corpo `{ model, input: [{type:"text",text}, {type:"image",mime_type:"image/jpeg",data}…], response_format: {type:"image", aspect_ratio, image_size:"2K"} }`;
  - a imagem volta em base64 em `output_image.data`.
- **Proporção:** peça `aspect_ratio: "4:5"`. A doc não lista o 4:5, então, na primeira chamada real, se a API responder 400 por causa da proporção, use `"3:4"`. A constante fica em `PROPORCAO`. A saída é **sempre** recortada para 1080×1350 sem deformar (`scale=1080:1350:force_original_aspect_ratio=increase,crop=1080:1350`).
- **Referências:**
  - de 1 a 4 fotos de pessoas, porque o limite do modelo é de 4 personagens;
  - mais a camisa, que é `assessoria/fotos/genericas/camisa.jpg` por padrão;
  - todas dentro de `assessoria/fotos/`, conferidas com o `dentroDe` de `caminhos.mjs`;
  - cada uma reduzida para **1536 px no lado maior**, em JPEG, antes do envio.
- **Versões:** 3 por padrão e no máximo 4, com uma requisição por versão, em sequência. Se uma falhar, as outras ficam gravadas, e a saída diz qual falhou e por quê.
- **Tempo limite:** 120 s por requisição (`AbortSignal.timeout`).
- **Saída:** `assessoria/saidas/<AAAA-MM-DD>-montagem[-2…]/v1.jpg…vN.jpg`, mais `pedido.json` com `{texto, prompt, modelo, fotos, camisa, versoes}`, sem a chave e sem o base64. A pasta segue a mesma regra de nunca sobrescrever do `gerar.mjs` (`pastaSaida`). Os caminhos saem em JSON no stdout.
- **Prompt:** o texto do Fabio vai inteiro, seguido desta parte fixa:

  > "Foto realista, estilo fotojornalismo esportivo. Mantenha os rostos exatamente como nas fotos de referência das pessoas. Todos vestem a camisa idêntica à imagem de referência da camisa. Sem texto, letras ou logotipos inventados na imagem."

## Review Focus
1. **A IA recusa** porque a foto é de pessoa real ou por um bloqueio de segurança, e a resposta vem sem `output_image`. O script não quebra: ele guarda o texto do modelo (`output_text`) na mensagem de erro daquela versão e mantém as outras. Teste na Task 1.
2. **Chave ausente, sem faturamento (403) ou com cota estourada (429).** A mensagem diz o que fazer, como "ative o faturamento no AI Studio" ou "espere e tente de novo", e nunca contém a chave. Teste na Task 1.
3. **Foto enorme (5000 px).** O corpo enviado fica pequeno porque a referência foi reduzida antes. Teste na Task 1.
4. **Resposta numa proporção diferente** (1:1 ou 3:4). A versão sai em 1080×1350, recortada sem deformar. Teste na Task 1.
5. **Rosto mudado pela IA.** Não dá para testar por código. A proteção é humana: sempre vêm várias versões, e o Fabio escolhe. Isso fica na regra do terminal, na Task 2.

---

### Task 1: `montagem.mjs` e formato `foto` · IM-86
**Files:**
- Create: `assessoria/montagem.mjs` e `assessoria/montagem.test.mjs`.
- Modify: `assessoria/gerar.mjs` (formato `foto`), `assessoria/gerar.test.mjs` e `assessoria/README.md`.

**Interfaces (Produces):**
- **CLI:** `node assessoria/montagem.mjs <pedido.json>`, com `pedido = {texto: string, fotos: string[], camisa?: string, versoes?: number}`. Os caminhos são relativos à raiz do repo ou absolutos, sempre dentro de `assessoria/fotos/`. O stdout traz `{pasta, versoes: [caminho…], falhas: [{versao, erro}]}`, e a saída é 1 se nenhuma versão sair.
- **Exports, para teste:**
  - `montarCorpo(pedido, imagensBase64, modelo) -> object`;
  - `montagem(pedido, {chave, modelo, fetch = globalThis.fetch, base}) -> Promise<{pasta, versoes, falhas}>`;
  - `class ErroMontagem extends Error`.
- **No `gerar.mjs`:** o formato `foto {foto}` grava `arte.jpg` (a foto recortada em 1080×1350, sem texto nem modelo HTML) e `mini.jpg`. Aqui o `foto` pode estar em `assessoria/fotos/` **ou** em `assessoria/saidas/`, para aceitar uma versão da montagem direto.

- [ ] **Step 1: Testes que falham**, em `montagem.test.mjs`, com um `fetch` falso. A imagem de resposta é um JPEG gerado pelo ffmpeg no teste.
  - `corpo: texto + prompt fixo, 1 imagem por foto e a camisa por último, aspect_ratio PROPORCAO e image_size 2K`
  - `3 versões: 3 chamadas, v1..v3 em 1080×1350 (ffprobe) e pedido.json sem chave nem base64`
  - `resposta quadrada sai 1080×1350 sem deformar`: o mock devolve um 1024×1024 com uma barra no meio. Confira a dimensão com o ffprobe e veja que a barra continua centrada.
  - `foto de 5000 px: cada imagem no corpo tem no máximo 1536 px no lado maior`: decodifique o base64 enviado e confira com o ffprobe.
  - `recusa sem output_image: aquela versão vai para falhas com o output_text; as outras ficam`
  - `403, 429 e chave ausente: mensagem clara e sem a chave`
  - `foto fora de assessoria/fotos, 0 ou 5 fotos, versoes 5: erro antes de qualquer fetch`
  - `nenhuma versão saiu: a CLI sai com 1`
  - em `gerar.test.mjs`: `formato foto: arte 1080×1350 e mini 800 a partir de uma imagem de saidas/; caminho fora dá erro`
- [ ] **Step 2:** `node --test assessoria/` falha nos testes novos.
- [ ] **Step 3: Implementar.** A redução e o recorte usam o ffmpeg por `execFileSync`, sem shell, como no `gerar.mjs`. A busca da pasta livre reaproveita a `pastaSaida`, exportada do `gerar.mjs`.
- [ ] **Step 4:** `node --test assessoria/` passa inteiro.
- [ ] **Step 5:** na seção nova "Montagem" do README, documente:
  - o pedido e a saída;
  - as variáveis `GEMINI_API_KEY` e `GEMINI_MODELO_IMAGEM`;
  - o custo por versão;
  - que é preciso ter faturamento no AI Studio;
  - que a imagem vem com a marca d'água invisível SynthID.
- [ ] **Step 6:** commit `feat: montagem com o Gemini na assessoria [IM-86]`.

### Task 2: regras do terminal e teste de fumaça · Maestro · IM-87
- [ ] No `assessoria/CLAUDE.md`, adicione:
  - a ferramenta "Montagem", com o comando;
  - o formato "Montagem", com este fluxo:
    1. as fotos dos jogadores vêm do banco aprovado, ou passam pela escolha normal se faltarem;
    2. a camisa vem de `fotos/genericas/camisa.jpg`, escolhida pelo Fabio uma vez;
    3. gerar 3 versões e mostrar os caminhos;
    4. **o Fabio escolhe**;
    5. `gerar.mjs foto`;
    6. legenda;
    7. postar só com OK.
- [ ] Atualize no `CLAUDE.md` a regra "Não use foto que não foi aprovada": uma versão da montagem só vale depois que o Fabio a escolher. Para usá-la como fundo de outro formato, copie para `assessoria/fotos/montagens/<slug>.jpg` e registre no `indice.json` com `fonte: "montagem Gemini"`.
- [ ] Na spec, registre a mudança da não-meta, com data e a decisão do Fabio.
- [ ] O Fabio coloca `GEMINI_API_KEY` no `.env`. **O Claude não lê nem escreve o `.env`.**
- [ ] Teste de fumaça com o Fabio: uma montagem real, de 2 jogadores se abraçando com a camisa, do pedido ao post.
