# Pack 3 · Onda C: design (IM-67, Task C0)

Sem Penpot nesta entrega (plugin desconectado, como na onda B): o handoff é só este doc. Plano: `docs/superpowers/plans/2026-11-05-pack3-onda-c.md` (Global Constraints: story de texto até 200 caracteres, fundos `gramado | carvao | vermelho | azul`; MCP). Base: `fundamentos.md`, `onda-c.md` §5 (faixa, visualizador, criar story), `instalar-troca-admin.md` (admin). Celular primeiro (390 px). Fonte local, nada de Google Fonts.

## Tokens

Todos existem, **menos o azul**. O app não tem nenhum azul, então proponho **um token novo**:

```css
--im-azul: #1E56B0;  /* fundo do story de texto "azul" */
```

Por que esse: é o azul mais escuro que ainda lê como azul (não vira carvão) e dá contraste 6,06:1 com `--im-giz`. Só vale para o fundo do story (e a bolinha dele); não entra em botão, link ou ícone.

Contraste do texto em cada fundo (WCAG, calculado):

| `fundo` | Cor do fundo | Cor do texto | Contraste |
|---|---|---|---|
| `gramado` | `--im-gramado` #2FA866 | **`--im-carvao`** | 6,31:1 |
| `carvao` | `--im-superficie` #17191C (não `--im-carvao`, para não sumir no fundo do app) | `--im-giz` | ≥ 15:1 |
| `vermelho` | `--im-vermelho` #D2261F | `--im-giz` | 4,52:1 |
| `azul` | `--im-azul` #1E56B0 | `--im-giz` | 6,06:1 |

Atenção: **giz sobre gramado dá 2,64:1 e reprova**; por isso o texto do gramado é carvão. Os 4 passam AA (4,5:1).

## 1. Story de texto no visualizador (`/stories/:clubeId`)

Mesmo visualizador de `onda-c.md` §5.2: barras, cabeçalho, gestos e “Visto por” iguais. Muda só o miolo:
- **Fundo:** a tela inteira na cor do `fundo` (atrás do degradê do topo, que continua preto 35%).
- **Texto:** centralizado na horizontal e na vertical, Barlow Condensed 800, caixa normal (não maiúscula), entrelinha 1,1, margem lateral 32, `text-wrap: balance`, quebra de linha do autor respeitada, `overflow-wrap: anywhere`.
- **Tamanho por comprimento** (3 faixas, por caracteres):

| Caracteres | Tamanho |
|---|---|
| 1 a 60 | 56 px |
| 61 a 120 | 40 px |
| 121 a 200 | 30 px |

  Com 200 caracteres a 30 px cabem ~9 linhas de 326 px de largura, folga na altura de 844. Tudo ≥ 30 px, então vale AA de texto grande e também o normal.
- **Duração:** 5 s, como imagem. Não tem botão de som.
- Cabeçalho (escudo, nome, “por Paulo · há 3 h”) em giz sobre o degradê; no fundo `gramado` o degradê garante a leitura.

| Tela | O que mostra |
|---|---|
| `story-texto-gramado` | Frase curta (56 px) em carvão sobre gramado |
| `story-texto-carvao` | Texto médio (40 px) |
| `story-texto-vermelho` | Texto de 200 caracteres (30 px) |
| `story-texto-azul` | Texto com quebra de linha |
| `story-texto-autor` | Visão do autor com “Visto por 8” e lixeira |

Estados: carregando, erro e expirado são os de `onda-c.md` §5.2 (story de texto não tem mídia para carregar: a tela já nasce pronta). Na faixa do feed a bolinha é a mesma (anel + escudo).

## 2. Criar story: Foto/vídeo ou Texto (`/stories/novo`)

O passo **Escolher** passa a ter **três** cartões de 120 em coluna (vão 12): **Foto**, **Vídeo** e **Texto** (ícone `texto`, “Até 200 caracteres, sobre um fundo colorido.”). Foto e Vídeo seguem iguais. Texto abre a tela de escrever (sem seletor do celular).

**Escrever** (`criar-story-texto`): X, título “Story de texto”.
- Prévia viva no topo: retângulo 9:16 de 180 × 320, raio 12, no fundo escolhido, com o texto no mesmo estilo e nas 3 faixas de tamanho (escala 0,5).
- Campo `textarea`, `--im-superficie`, borda `--im-linha`, raio `--im-r-btn`, 3 linhas, `maxlength` 200, placeholder “O que você quer dizer?” (giz-3), foco com borda 2 px giz. Rótulo escondido “Texto do story”.
- **Contador “0/200”** embaixo à direita em `legenda` giz-2; a partir de 180 fica `--im-amarelo`, e em 200 `--im-vermelho-texto` (o número, sempre com texto, nunca só cor). `aria-live="polite"`, anunciado só ao cruzar 180 e 200.
- **Fundos:** `radiogroup` “Fundo” com 4 bolinhas de 44 (alvo 44) e vão de 12, cada uma com o rótulo em `legenda` embaixo (Gramado, Carvão, Vermelho, Azul). Selecionada: anel de 2 px `--im-giz` a 3 px de distância + `ok` 20 dentro (carvão no gramado, giz nos outros). A selecionada nunca é só cor: anel e check. Padrão **Gramado**. Setas ← → trocam.
- Admin vê o interruptor **Postar como CBF** (cartão de 52, o mesmo da prévia de foto).
- Botão fixo **Publicar story** (primário, 358 × 48). Desabilitado com texto vazio ou só espaços; o texto é cortado nas pontas antes de enviar.

| Tela | O que mostra |
|---|---|
| `criar-story-escolher-3` | Três cartões: Foto, Vídeo, Texto |
| `criar-story-texto-vazio` | Prévia com o placeholder, 0/200, botão desabilitado |
| `criar-story-texto` | Texto curto, fundo azul escolhido, 24/200 |
| `criar-story-texto-limite` | 200/200 em vermelho-texto; não aceita mais |
| `criar-story-texto-enviando` | Botão com spinner “Publicando…”, campo travado (some a barra de MB: é só texto) |
| `criar-story-texto-erro` | Caixa com borda `--im-vermelho-texto`: “Não deu para publicar o story” + **Tentar de novo**; o texto fica no campo |
| `criar-story-texto-sem-permissao` | O 403 que já existe (“Só técnico de clube posta story”) |

Erros do servidor: `400` de texto longo ou fundo inválido não deve acontecer pela interface (o campo limita e as bolinhas são fixas); se vier, cai na caixa de erro acima. Publicado: volta ao feed com “Story publicado”.

## 3. Admin: aba **MCP**

`/admin` hoje é uma lista de linhas (`admin-inicio`). Entra a linha **Ações da CBF via MCP** (ícone `chave`, valor “12 nas últimas 24 h”) abaixo de “Clubes e técnicos”; abre `/admin/mcp`. Se a lista de abas de `/admin` já for um controle segmentado no código, **MCP** é a aba nova; o conteúdo é o mesmo.

**Log** (`GET` do log, mais novo primeiro): cartões de 72 em coluna, vão 8, `--im-superficie`, borda `--im-linha`, raio 12, padding 12:
- Linha 1: nome da ferramenta em Inter 600 14 (`criar_post`, `lancar_placares`…) e à direita o selo de resultado. **ok**: `ok` 16 `--im-gramado` + “ok”; **erro**: `alerta` 16 `--im-vermelho-texto` + “erro” (ícone e palavra, nunca só cor).
- Linha 2: entrada resumida em `legenda` giz-2, uma linha, corta com … (ex.: “rodada 12 · 10 placares”).
- Linha 3: “há 5 min” em `micro` giz-3. Em erro, a mensagem curta sob a entrada em `--im-vermelho-texto` (máx. 2 linhas).
- Tocar não abre nada (v1 só lista). Rolagem infinita, 20 por página.

| Tela | O que mostra |
|---|---|
| `admin-mcp` | 6 ações, 5 ok e 1 erro |
| `admin-mcp-vazio` | Caixa de estado vazio (`--im-superficie`, borda `--im-linha`, raio 12): ícone `chave` giz-3, **“Nenhuma ação da CBF via MCP ainda.”**, e `legenda` giz-2 “Quando o Claude agir pela chave da CBF, aparece aqui.” |
| `admin-mcp-carregando` | 5 cartões de esqueleto, pulso `--im-pulso` (parado em `prefers-reduced-motion`) |
| `admin-mcp-erro` | Caixa “Não deu para carregar o log” + **Tentar de novo** |
| `desktop-admin-mcp` | Barra lateral de `feed.md`, coluna de 640 |

## Ícones

Nenhum novo: `texto`, `chave`, `ok`, `alerta` e `camera`/`video` já existem em `docs/design/icones/` (24/24, traço 1,75).

## Acessibilidade

- Contador `aria-live="polite"`; o limite também em `aria-describedby` do campo.
- Fundos: `role="radiogroup"` com `role="radio"` e rótulo visível; foco 2 px giz.
- Story de texto: o texto é `<p>` real (leitor de tela lê), não imagem.
- Log: lista `<ul>`; ok/erro com palavra e ícone.

## Pendências (aprovadas pelo Maestro em 2026-11-05)

1. **Token novo `--im-azul: #1E56B0`** (não existe azul no app). Alternativa sem token: usar `--im-superficie-alta` cinza, mas deixa de ser azul.
2. Texto do gramado em **carvão** (giz reprova AA).
3. Fundo `carvao` do story usa `--im-superficie`, para não confundir com o fundo do app.
4. Admin: linha nova em `/admin` (ou aba, conforme o front).
