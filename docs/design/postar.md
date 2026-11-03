# Grupo 3: novo post e editar post (IM-20, Task D2)

Postar pelo celular em poucos toques (é anti-objetivo do produto ser difícil de postar). Fonte visual: Penpot, página **Postar (D2-3)** (18 telas, com os nomes da tabela abaixo). Tokens, tipografia e componentes: `docs/design/fundamentos.md`. Barra inferior e card: `docs/design/feed.md`. Nada novo de cor, fonte ou espaço.

## O fluxo e o custo em toques

Rota `/postar` (item **Postar** da barra inferior; só técnico, torcedor vê a folha de `feed.md`).

1. **Imagens** → toque em **Escolher imagens** (1) → seleciona várias no seletor do celular (2, fora do app) → **Continuar** (3).
2. **Legenda e prompts** → escreve a legenda (opcional) → **Publicar** (4). Prompt é opcional e começa fechado: quem não usa prompt não precisa tocar em nada além da legenda.
3. **Publicar** → progresso (sem toque) → volta ao feed com o post no topo.

Do botão Postar ao post publicado: **4 toques** (mais a escolha no seletor e a digitação da legenda). Nenhuma tela de “parabéns”, nenhuma confirmação extra, nenhuma tela de pré-visualização.

Regras gerais: botão principal fixo embaixo (358 × 48, sobe com o teclado, `100dvh`); X ou voltar do celular em qualquer passo com conteúdo pede confirmação (`imagens-descartar`); sem conteúdo, sai direto. O estado do passo 1 e do 2 fica em memória (não em `localStorage`).

## Passo 1: escolher imagens

Barras de passo e “Passo 1 de 3” como no cadastro (`acesso.md`); X à esquerda.

| Tela (board) | O que tem |
|---|---|
| `imagens-vazio` | Título “Escolha as imagens”, texto “Até 10 por post. Elas são reduzidas no celular antes de enviar, então sobem rápido.” Área tracejada com ícone, “Fotos e prints do celular”, “JPEG ou PNG” e o botão **Escolher imagens**. **Continuar** desabilitado |
| `imagens-escolhidas` | Grade de 3 colunas (114 px, vão 8) com número de ordem (canto superior esquerdo), **X** para remover (canto superior direito) e a etiqueta **Capa** na primeira. Último quadro tracejado “Adicionar”. Texto de apoio “4 de 10 imagens. A primeira é a capa e define o formato do post no feed.” |
| `imagens-preparando` | Miniaturas ainda não prontas ficam com véu escuro e spinner. Botão desabilitado “Preparando 2 de 4…”. Compressão e redução acontecem no celular (WebP/JPEG, lado maior ≤ 1600 px para a cheia e ≤ 800 px para a mini; o back valida JPEG, então enviar JPEG) |
| `imagens-erro-formato` | Aviso (borda `--im-vermelho-texto`) “Não deu para ler foto-12.heic. Escolha outra imagem ou exporte como JPEG.” A miniatura fica com borda vermelha, ícone `alerta` e “Não lida”; o X a remove. As outras seguem e **Continuar** fica ativo |
| `imagens-mais-de-10` | Aviso âmbar “O limite é 10 imagens. As 3 últimas ficaram de fora.” Entram as 10 primeiras; o quadro “Adicionar” some |
| `imagens-descartar` | Diálogo “Descartar este post?” / “Você escolheu 4 imagens. Se sair agora, a escolha se perde.” **Continuar editando** (primário) e **Descartar** (fantasma) |

Detalhes:
- Ordem = ordem da escolha; arrastar uma miniatura troca a posição. A primeira vira a **capa** e define a proporção do quadro no feed (`feed.md`).
- `<input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" multiple>`: aceitar HEIC no seletor para o iPhone converter sozinho quando puder; se o navegador não decodificar, cai em `imagens-erro-formato` (a miniatura marca o arquivo, não trava o fluxo).
- Cada arquivo final ≤ 3 MB (limite da API). Se uma imagem passar disso mesmo reduzida, o mesmo erro da miniatura vale, com a frase “Essa imagem ficou grande demais. Escolha outra.”
- Desktop: o passo 1 também aceita arrastar e soltar sobre a área tracejada.

## Passo 2: legenda e prompts

Voltar (seta) à esquerda, “Passo 2 de 3”. Abaixo do título, “Vai sair como Palmeiras, por Lincoln.” (legenda, giz-2): deixa claro por qual clube o post sai.

| Tela (board) | O que tem |
|---|---|
| `legenda-prompts` | Campo **Legenda** (caixa de 120 px, contador “104/2200” à direita embaixo). Seção “Prompts, se quiser” com a ajuda “Cole o prompt que gerou cada imagem. Ele vai para a galeria, com botão de copiar.” Uma linha por imagem: miniatura 56 px, “Imagem 1 · capa” e, embaixo, **Adicionar prompt** (ícone + e texto giz-2) ou, se já tem, as 2 primeiras linhas do prompt e **Editar prompt** (sublinhado) |
| `legenda-prompt-editando` | Linha aberta: campo “Prompt da imagem 2” com foco (borda giz 2 px, 96 px de altura, contador “81/4000”). Só um prompt aberto por vez (abrir outro fecha este e guarda o texto) |
| `legenda-erro` | Legenda acima de 2200: borda e contador em `--im-vermelho-texto` com a frase que diz quanto cortar (“2310/2200. Corte 110 caracteres.”) e **Publicar** desabilitado. Para o prompt, igual com 4000 |

Detalhes:
- A legenda pode ficar vazia (a API só exige imagem). Publicar só fica desabilitado por estouro de limite ou imagem não pronta.
- A cada linha: toque na miniatura abre a imagem em tamanho grande (folha simples) para conferir qual é.
- Os textos entram como estão (sem formatação); quebras de linha são mantidas.

## Passo 3: publicar

Sem seta de voltar e sem X: o único controle é **Cancelar envio**. O envio é um único pedido (`POST /api/posts`, multipart), então o progresso é pelos **bytes**.

| Tela (board) | O que tem |
|---|---|
| `publicando` | “Publicando…”, “Enviando 4 imagens e a legenda.”, as miniaturas, barra de progresso (8 px, `--im-vermelho` sobre `--im-superficie-alta`, raio 4), “62%” em Barlow Condensed 600 à esquerda e “1,9 de 3,1 MB” à direita, “Não feche o app até terminar.” e **Cancelar envio** (fantasma). Cancelar aborta o pedido e volta ao passo 2 com tudo preenchido |
| `publicado` | Volta direto ao feed com o post novo no topo (“agora”) e o aviso rápido “Post publicado” (barra `--im-superficie-alta`, ícone `ok` em `--im-gramado`, 3 s) acima da barra inferior. Sem tela de parabéns |
| `envio-falhou` | Barra parada e em `--im-vermelho-texto`, ícone `alerta`, “Não deu para publicar”, “O envio parou em 62%. Nada foi publicado. Sua legenda e os prompts continuam aqui.” **Tentar de novo** (primário, reenvia tudo; as imagens já reduzidas ficam em memória) e **Voltar e editar** (secundário, leva ao passo 2). Vale para queda de rede, `5xx` e `413` |
| `envio-sem-permissao` | `SEM_CLUBE` (403): quem deixou de ser técnico no meio. Ícone âmbar, “Você não pode publicar agora” e o texto explicando; botões **Ver clubes livres** (grupo 5) e **Voltar ao feed**. Sem “Tentar de novo”, porque não adianta |

Detalhes:
- `MUITAS_TENTATIVAS` e `IMAGEM_INVALIDA` (400, raro, porque o celular já envia JPEG): usar a tela de falha com o texto “Alguma imagem não passou na conferência do servidor. Volte e escolha outra.” e só **Voltar e editar**.
- Ao publicar com sucesso: invalidar o feed, zerar a escolha e rolar o feed ao topo. O push para os outros sai do servidor, sem tela no app.

## Editar um post existente

Abre pelo ⋯ do post (só técnico atual do clube e admin, ver `feed.md`) → **Editar legenda e prompts**. Rota `/post/:id/editar`. Chama `PATCH /api/posts/:id {legenda, prompts}`.

| Tela (board) | O que tem |
|---|---|
| `editar-post` | Seta de voltar, título “Editar post”, “Palmeiras · publicado há 2 horas”, as miniaturas só como referência e a frase “As imagens não mudam. Para trocar, apague o post e publique de novo.” Campo **Legenda** preenchido e a seção **Prompts** com as mesmas linhas do passo 2. Botão fixo **Salvar alterações** (só acende se algo mudou) |
| `editar-salvando` | Botão “Salvando…” com spinner; campos inertes |
| `editar-erro` | Aviso “Não deu para salvar. Confira a conexão e tente de novo. O que você escreveu continua aqui.” e o botão ativo |
| `editar-sem-permissao` | `NAO_E_TECNICO` (403): aviso “Você não é mais técnico deste clube. Só o técnico atual e o admin editam.”, campos a 55% e **Salvar alterações** desabilitado |

Detalhes:
- Salvar com sucesso volta ao feed (ou ao lugar de onde veio) com o aviso rápido “Alterações salvas”.
- Voltar com mudanças pede a mesma confirmação do novo post (“Descartar as alterações?” / **Continuar editando** / **Descartar**).
- Apagar não fica aqui: está no menu do post (`feed.md`).

## Desktop (a partir de 768 px)

`desktop-legenda-prompts`: o passo vira um cartão `--im-superficie` de 560 px (raio 12, borda 1 px `--im-linha`) no centro, com a barra lateral de 220 px (`feed.md`). Imagens e prompts em 2 colunas de 232 px com miniatura de 72 px. **Voltar** (secundário) e **Publicar** (primário) lado a lado no rodapé do cartão. O passo 1 é o mesmo cartão com a área de arrastar e soltar. Passo 3 é o mesmo cartão com o progresso.

## Acessibilidade

- Cada miniatura é um botão com `aria-label` “Remover imagem 2” no X; o grupo é `role="list"`, com “4 de 10 imagens” em `aria-live="polite"`.
- Barra de progresso: `role="progressbar"` com `aria-valuenow`, `aria-valuemin="0"`, `aria-valuemax="100"` e texto “Publicando, 62%”.
- Erros em `role="alert"`; campo com erro ligado por `aria-describedby`; foco vai para o primeiro campo ou miniatura com problema.
- Alvos de toque de 44 px (o X da miniatura tem 30 px visíveis dentro de uma área de 44 px).
- Spinner e pulso respeitam `prefers-reduced-motion` (ficam estáticos, com o texto “Preparando…”).

## Pendências para aprovar

1. Postar em 4 toques (Postar → Escolher imagens → Continuar → Publicar), sem tela de parabéns e sem pré-visualização.
2. Prompt por imagem fechado por padrão (“Adicionar prompt”), um aberto por vez.
3. Aceitar HEIC no seletor e tratar a falha por miniatura (em vez de bloquear o passo).
4. Tentar de novo reenvia tudo (a API grava só se tudo passar), por isso o progresso é por bytes e não por imagem.
5. Editar só legenda e prompts; para trocar imagem, apagar e postar de novo.
