# Assessoria do Botafogo: montagem pelo Gemini no portal (plano)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> Fluxo do Maestri: um card por task e um andar para a IM-86, que passa por dev → VAR → QA → merge. **Não há deploy**, porque `assessoria/` fica fora do app.

**Goal:** O Estrela Solitária gera montagens, como "jogadores se abraçando com a camisa do Botafogo", no **app do Gemini do Fabio** (plano Plus, sem custo extra), dentro de um portal do Maestri. O Fabio escolhe uma das versões, e ela vira post.

**Architecture:**
- **`assessoria/montagem.mjs`** (Node e ffmpeg, sem dependência npm), com dois comandos:
  - `preparar` reduz as fotos de referência e escreve o pedido;
  - `receber` transforma a imagem que veio do Gemini numa versão de 1080×1350.
- **O terminal** usa o portal "Gemini" (gemini.google.com, logado pelo Fabio) para:
  1. subir as referências;
  2. colar o pedido;
  3. esperar a imagem;
  4. tirar a imagem em tamanho cheio direto para um arquivo, por shell, sem o base64 passar pelo modelo.
- **O formato novo `foto`, no `gerar.mjs`,** transforma a versão escolhida em arte e mini. O `postar.mjs` posta como hoje.

**Tech Stack:** Node (`node --test`), ffmpeg e `maestri portal` (`upload`, `fill`, `evaluate`).

**Spec:** `docs/superpowers/specs/2026-11-05-assessoria-botafogo-design.md`, mais as decisões abaixo, que mudam a não-meta "não gera imagem com IA".

## Decisões (Fabio, 2026-11-07)
- **A assessoria pode gerar montagens com IA.** O app continua sem IA.
- **Usa o app do Gemini do Fabio (Plus), por portal no Maestri.** A API ficou fora porque não tem cota grátis para imagem (US$ 0,05 por imagem).
- **O Fabio aceita o risco.** Os termos do Google não gostam de acesso automatizado. O uso é baixo, numa janela visível e só quando ele pede. Se a conta reclamar, cai no modo manual da Task 2.
- **O Fabio vê as versões e escolhe uma.** Nada é postado sem o OK dele, e uma montagem que ele não escolheu não vira foto aprovada.

## Global Constraints
- **Referências:**
  - de 1 a 4 fotos de pessoas, mais a camisa, que é `assessoria/fotos/genericas/camisa.jpg` por padrão;
  - todas dentro de `assessoria/fotos/`, conferidas com o `dentroDe` de `caminhos.mjs`;
  - cada uma reduzida para **1536 px no lado maior**, em JPEG.
- **Versões:** 3 por padrão e no máximo 4, uma geração por versão.
- **Saída:** fica em `assessoria/saidas/<AAAA-MM-DD>-montagem[-2…]/`:
  - `ref-1.jpg…ref-N.jpg`, `camisa.jpg` e `pedido.txt`, gravados pelo `preparar`;
  - `v1.jpg…vN.jpg`, gravados pelo `receber`.

  A pasta segue a regra de nunca sobrescrever do `gerar.mjs` (`pastaSaida`, que passa a ser exportada).
- **Pedido** (`pedido.txt`): o texto do Fabio vai inteiro, seguido desta parte fixa:

  > "Gere uma foto realista, estilo fotojornalismo esportivo, formato vertical 4:5. Mantenha os rostos exatamente como nas fotos de referência das pessoas. Todos vestem a camisa idêntica à imagem de referência da camisa. Sem texto, letras ou logotipos inventados na imagem."
- **`receber`:**
  - aceita só JPEG, PNG ou WebP de verdade, conferido com o ffprobe;
  - recusa imagem com **menos de 1000 px no lado menor**, que provavelmente é miniatura ou captura de tela;
  - grava `vN.jpg` em 1080×1350 recortado sem deformar (`scale=1080:1350:force_original_aspect_ratio=increase,crop=1080:1350`), e N é o próximo número livre.

## Review Focus
1. **O que sai do portal vem errado:** uma miniatura em vez da imagem cheia, um HTML de erro ou um arquivo vazio. O `receber` recusa com uma mensagem clara e não grava a versão. Teste na Task 1.
2. **O Gemini responde de outro jeito:** devolve uma imagem quadrada ou paisagem, ignorando o 4:5. A versão sai em 1080×1350 sem deformar. Teste na Task 1.
3. **Foto enorme (5000 px):** a referência subida tem no máximo 1536 px. Teste na Task 1.
4. **O Gemini recusa** (pessoa real, segurança) **ou a cota diária do Plus acaba:** o terminal mostra ao Fabio o que o Gemini respondeu e para. Ele não insiste em loop. Regra na Task 2.
5. **O site do Gemini muda e a receita do portal quebra:** o terminal cai no modo manual (o Fabio gera e salva a imagem, e o `receber` continua). Regra na Task 2.

---

### Task 1: `montagem.mjs` e formato `foto` · IM-86
**Files:**
- Create: `assessoria/montagem.mjs` e `assessoria/montagem.test.mjs`.
- Modify: `assessoria/gerar.mjs` (formato `foto` e `export` da `pastaSaida`), `assessoria/gerar.test.mjs` e `assessoria/README.md`.

**Interfaces (Produces):**
- **Preparar:** `node assessoria/montagem.mjs preparar <pedido.json>`, com `pedido = {texto: string, fotos: string[], camisa?: string, versoes?: number}`. Os caminhos são relativos à raiz do repo ou absolutos. O stdout traz `{pasta, referencias: [caminho…], pedido: caminho, versoes}`.
- **Receber:** `node assessoria/montagem.mjs receber <pasta-da-montagem> <arquivo>`. A pasta precisa estar dentro de `assessoria/saidas/`, e o arquivo pode estar em qualquer lugar, porque é o que veio do portal ou do download. O stdout traz `{versao: caminho}`, e um erro sai com código 1.
- **Exports:** `preparar(pedido, {base}) -> {pasta, referencias, pedido, versoes}`, `receber(pasta, arquivo, {base}) -> {versao}` e `class ErroMontagem extends Error`.
- **No `gerar.mjs`:** o formato `foto {foto}` grava `arte.jpg` (a foto recortada em 1080×1350, sem modelo HTML) e `mini.jpg`. Aqui o `foto` pode estar em `assessoria/fotos/` **ou** em `assessoria/saidas/`.

- [ ] **Step 1: Testes que falham** (as imagens vêm do ffmpeg no teste, com `testsrc2`):
  - `preparar: ref-1..N e camisa.jpg, cada uma com até 1536 px no lado maior, mesmo de uma foto de 5000×3000`
  - `preparar: pedido.txt = texto do Fabio + parte fixa`
  - `preparar: foto fora de assessoria/fotos, 0 ou 5 fotos, versoes 5, camisa padrão ausente: erro claro e nenhuma pasta criada`
  - `receber: 2048×2048 vira v1.jpg 1080×1350; o segundo vira v2.jpg`
  - `receber: imagem com 800 px no lado menor, arquivo de texto e arquivo vazio são recusados e nada é gravado`
  - `receber: pasta fora de assessoria/saidas é recusada`
  - em `gerar.test.mjs`: `formato foto: arte 1080×1350 e mini 800 a partir de saidas/; caminho fora de fotos/ e saidas/ dá erro`
- [ ] **Step 2:** `node --test assessoria/` falha nos testes novos.
- [ ] **Step 3: Implementar.** O ffmpeg e o ffprobe rodam por `execFileSync`, sem shell, como no `gerar.mjs`.
- [ ] **Step 4:** `node --test assessoria/` passa inteiro.
- [ ] **Step 5:** README, numa seção nova "Montagem", com os dois comandos e o formato `foto`.
- [ ] **Step 6:** commit `feat: montagem (preparar/receber) e formato foto na assessoria [IM-86]`.

### Task 2: receita do portal, regras e teste de fumaça · Maestro · IM-87
- [ ] **Portal "Gemini":** o Maestro cria o portal em `https://gemini.google.com/app`, ligado ao terminal Estrela Solitária, e **o Fabio faz o login**.
- [ ] **Teste da receita, junto com o Fabio, numa montagem real.** Ele precisa confirmar:
  1. `maestri portal upload` sobe as referências no botão de anexar;
  2. `fill` coloca o `pedido.txt` e `key Enter` envia;
  3. o terminal espera a imagem aparecer, conferindo o `snapshot` a cada poucos segundos, com limite de 3 min;
  4. a imagem cheia sai direto para um arquivo, sem passar pelo modelo. Por exemplo: `maestri portal evaluate` com um `fetch` da imagem que devolve base64, num pipe com `base64 -d > /tmp/...`, e depois `montagem.mjs receber`. Se o `fetch` não trouxer a imagem cheia, use o botão de download do Gemini e veja onde o portal salva.
  5. Para a versão seguinte, abra uma conversa nova, para que as versões não se misturem.
- [ ] **No `assessoria/CLAUDE.md`,** escreva:
  - a receita que funcionou, passo a passo;
  - o formato "Montagem": fotos aprovadas (ou a escolha normal, se faltarem), a camisa escolhida pelo Fabio uma vez, `preparar`, as versões pelo portal, `receber`, mostrar os caminhos, **o Fabio escolhe**, `gerar.mjs foto`, a legenda e o post só com OK;
  - as regras:
    - só gere quando o Fabio pedir;
    - se o Gemini recusar ou a cota acabar, mostre a resposta e pare;
    - **modo manual:** se a receita falhar, peça ao Fabio que gere no Gemini e salve a imagem, e continue no `receber`;
    - uma versão só vale depois que o Fabio a escolher. Para usar uma montagem como fundo de outro formato, copie para `assessoria/fotos/montagens/<slug>.jpg` e registre no `indice.json` com `fonte: "montagem Gemini"`;
    - não mexa em outras conversas nem nas configurações da conta do Gemini.
- [ ] **Na spec,** registre a mudança da não-meta, com data e a decisão do Fabio.
- [ ] **Teste de fumaça com o Fabio:** 2 jogadores se abraçando com a camisa, do pedido ao post.
