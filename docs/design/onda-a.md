# Pack 2 · Onda A: design (IM-30, Task A0)

Fonte visual: Penpot, página **Pack 2 · Onda A** (36 telas, com os nomes das tabelas abaixo). Spec: `docs/superpowers/specs/2026-11-04-instamanager-pack2-design.md` (§4.1, 4.2, 4.5, 4.6, 4.11, 4.12, 4.14, 4.15). Tudo dentro dos fundamentos: tokens, tipografia e componentes de `fundamentos.md`; card e barra de `feed.md`; perfil e galeria de `perfis.md`; postar de `postar.md`; admin de `instalar-troca-admin.md`. Celular primeiro (390 px), desktop só onde muda.

A navegação **não muda** na onda A (Feed, Galeria, Postar, Clube, Perfil). A barra nova (Liga e Atividade) é da onda B.

Ícones novos (mesmo estilo: grade 24, traço 1,75, currentColor), em `docs/design/icones/`: `compartilhar`, `fixar`, `estrela`, `bandeira` (denunciar), `olho-off` (ocultar), `texto`, além de `editar`, `lixo` e `ok` que já existem.

Mudanças em regras antigas (valem a partir daqui):
- **⋯ no card (`feed.md`)**: agora **todo post tem o ⋯**, mas o conteúdo do menu depende de quem vê (tabela em “Menu do post”). Continua valendo: nunca há item desabilitado; o que a pessoa não pode fazer simplesmente não aparece.
- **“N curtidas” (`feed.md`)** vira a linha de reações (“14 reações”). A API antiga (`curtidas`, `curtiu`) segue igual por baixo.

## 1. Reações

Conjunto fixo, nesta ordem: ❤️ Coração, 🔥 Fogo, 😂 Risada, 😮 Surpresa, 😢 Triste, 👏 Palmas. Uma reação por pessoa por post. Emoji do sistema (Apple Color Emoji, Noto Color Emoji), sem imagem nem fonte nova.

**Linha de ações do card** (24 px, alvo 44): **Reagir**, **Comentar** e, à direita, **Compartilhar** (seção 2). O botão Reagir mostra:
- sem reação: coração em traço (giz);
- com ❤️: coração cheio em `--im-vermelho` (como hoje);
- com outro emoji: o emoji a 24 px, no lugar do coração.

**Linha de reações** (substitui “N curtidas”): até 3 emojis mais usados (20 px, sobrepostos −6 px, anel de 2 px `--im-carvao`), do maior total para o menor, e o total em Barlow Condensed 600 16 + “reações” (singular “1 reação”). Zero reações: a linha some.

**Comportamento:**
- **Toque curto** no botão: sem reação → ❤️; com qualquer reação → tira.
- **Tocar e segurar** (≥ 350 ms) abre o seletor: pílula `--im-superficie-alta`, borda 1 px `--im-linha`, raio total, 6 emojis em alvos de 44 px (emoji 28 px), flutuando acima do botão. Arrastar o dedo escolhe o emoji sob ele (cresce a 125%); soltar aplica. Também dá para tocar num emoji. O da pessoa fica com um círculo `--im-superficie` atrás. Tocar fora ou Esc fecha sem mudar.
- **Toque duplo na imagem** (ou no texto do post de texto) dá ❤️ (troca a reação atual por ❤️ e nunca tira).
- Trocar 🔥 → 😂 atualiza na hora (otimista). Se a API falhar, volta e mostra o aviso “Não deu para reagir. Tente de novo.” (`role="alert"`).
- Animação: o emoji cresce a 125% e volta em 180 ms. Com `prefers-reduced-motion`, só troca.
- **Desktop:** passar o mouse 400 ms sobre o botão mostra o seletor; clique no botão é o toque curto; clicar num emoji aplica.

Acessibilidade: o botão é `<button aria-haspopup="menu" aria-expanded>` com `aria-label` “Reagir” (ou “Remover reação: Fogo”); o seletor é `role="menu"` com `role="menuitemradio"` por emoji, `aria-label` “Fogo”, “Risada” etc.; as setas ← → movem, Enter escolhe, Esc fecha. Também abre com a tecla ↑ e com a ação de acessibilidade “Mais reações”. A linha de reações tem `aria-label` completo (“14 reações: 6 coração, 5 fogo, 3 risada”).

| Tela (board) | O que mostra |
|---|---|
| `reacoes-card` | Card com a linha de ações (Reagir sem reação, Comentar, Compartilhar à direita) e a linha “14 reações” com 3 emojis |
| `reacoes-seletor` | Toque longo no botão: pílula com os 6 emojis acima do botão, 🔥 sob o dedo (125%) e o fundo do feed escurecido a 30% |
| `reacoes-reagiu` | Depois de escolher 🔥: o botão mostra 🔥 e a linha sobe para “15 reações” com 🔥 em primeiro |
| `reacoes-desktop` | Barra lateral + coluna de 470 px, seletor aberto por hover |

## 2. Compartilhar

Botão no card (ícone `compartilhar`, 24 px, alvo 44, à direita da linha de ações) e também no `/p/:id`.
- `navigator.share({ title: 'InstaManager', url })`, onde `url` = `https://instamanager.fj-dev.tech/p/<id>`.
- Sem Web Share API (ou se der erro que não seja cancelamento): copia o link e mostra o aviso rápido “Link copiado”.
- Cancelar a folha do sistema não mostra nada.
- Se nem copiar der: “Não deu para compartilhar. Copie o endereço do post na barra do navegador.” (`role="alert"`).
- **Prévia do link (WhatsApp):** genérica: ícone 512 + “InstaManager” (`og:title`) e o endereço. **Nunca** mostra legenda, imagem nem nome de clube, porque o app é fechado. Ver `compartilhar-previa`.

| Tela (board) | O que mostra |
|---|---|
| `compartilhar-copiado` | Card com o aviso rápido “Link copiado” (barra `--im-superficie-alta`, ícone `ok`, 3 s) acima da barra inferior |
| `compartilhar-previa` | Desenho de como o link aparece numa conversa: miniatura do ícone, “InstaManager”, “instamanager.fj-dev.tech” |

## 3. Posts só de texto

**Card de texto:** igual ao card normal (cabeçalho com escudo, clube, “por Lincoln”, ⋯), mas no lugar da imagem entra um **bloco de texto** de borda a borda em `--im-superficie`, sem raio, padding 24, altura mínima 200. Texto em Inter 600 e o tamanho cai conforme o comprimento: até 80 caracteres 28/34, até 200 caracteres 24/32, acima disso 20/28. Corta em 8 linhas com “mais” (expande no lugar). Não tem contador de imagens nem “Ver prompt”. Ações, linha de reações e comentários iguais aos do card normal.
- **`#tags`:** Inter 600 em `--im-vermelho-texto`, sem sublinhado, toque leva a `/tag/<palavra>` (ver seção 8). `#` sozinho ou dentro de URL não vira link.
- Nas grades de capas (clube, perfis): o post de texto vira um quadrado `--im-superficie` com as primeiras palavras em Barlow Condensed 700 18 (até 4 linhas) e o ícone `texto` no canto superior direito. **Não entra na galeria** (não tem prompt).
- Compartilhar usa o mesmo link; a prévia continua genérica.

**Postar texto:** em `/postar` entra a alternância **Foto | Texto** (controle de 2 segmentos, 358 × 44, raio total, fundo `--im-superficie`, borda 1 px `--im-linha`; ativo: fundo `--im-superficie-alta`, texto giz peso 600; inativo giz-2 peso 500). Lembra a última escolha. Só o técnico posta (igual à regra de hoje). O modo Texto tem **um passo só**:
- Campo grande (358 × 220, raio 10) com o texto, placeholder “O que está rolando?”, contador “0/500” no canto de baixo, “Vai sair como Palmeiras, por Lincoln.” em giz-2 acima. Dica “Dá para usar #tags.”
- **Publicar** fixo embaixo, desabilitado com 0 caracteres (só espaços não valem) ou acima de 500.
- Acima de 500: contador e borda em `--im-vermelho-texto` com “512/500. Corte 12 caracteres.”
- Publicando: botão “Publicando…” com spinner e campo inerte (sem barra de progresso, o envio é minúsculo). Falha: aviso “Não deu para publicar. Seu texto continua aqui.” e **Tentar de novo**. `SEM_CLUBE` igual a `postar.md`.
- Sucesso: volta ao feed com o post no topo e o aviso “Post publicado”.

| Tela (board) | O que mostra |
|---|---|
| `post-texto-card` | Card de texto (24/32) com `#tag` em vermelho-texto, linha de reações e comentários |
| `post-texto-tamanhos` | Os 3 tamanhos do texto (28/34, 24/32, 20/28) e a regra de cada um |
| `postar-foto-alternancia` | Passo 1 do postar com a alternância Foto \| Texto no topo (Foto ativa) |
| `postar-texto-vazio` | Modo Texto vazio, **Publicar** desabilitado |
| `postar-texto-escrevendo` | Texto digitado, “124/500”, Publicar ativo |
| `postar-texto-limite` | “512/500. Corte 12 caracteres.”, borda e contador em vermelho-texto, Publicar desabilitado |
| `postar-texto-publicando` | Botão “Publicando…” com spinner, campo a 55% |
| `postar-texto-erro` | Aviso de falha com **Tentar de novo** |

## 4. Fixado

- **Selo “Fixado”:** uma linha de 28 px acima do cabeçalho do card, com o ícone `fixar` (14 px) e “Fixado” em Inter 600 13, tudo em giz-2, alinhada a 16 px da borda. Os fixados aparecem no topo do feed, do mais recente fixado para o mais antigo (até 3), sem repetir na lista; só na primeira página do feed geral (sem `clube`, sem `tag`).
- **Menu do admin** (ver “Menu do post”): **Fixar no topo** / **Desafixar** e **Ocultar do feed** / **Mostrar de novo**.
- **4º fixado:** o botão devolve `LIMITE_FIXADOS` e a folha mostra o aviso âmbar “Já há 3 posts fixados. Desafixe um para fixar este.” Nada muda.
- Apagar ou ocultar um post fixado o tira dos fixados.
- **Oculto pelo admin:** quem não é admin **não vê** o post em lugar nenhum. O admin vê o card a 60% de opacidade com uma faixa âmbar de 40 px no topo (“Oculto para todos. Só você, admin, vê.” com o ícone `olho-off`). O menu dele troca para **Mostrar de novo**.

| Tela (board) | O que mostra |
|---|---|
| `fixado-feed` | Topo do feed com um post fixado (selo) seguido do primeiro post normal |
| `fixado-menu-admin` | Menu do admin: Editar legenda e prompts, Fixar no topo, Ocultar do feed, Apagar post, Cancelar |
| `fixado-limite` | A mesma folha com o aviso âmbar de limite de 3 fixados |
| `oculto-admin` | Como o admin vê um post oculto (faixa âmbar, opacidade 60%) |

## 5. Menu do post (⋯) por quem vê

| Quem vê | Itens (ícone + texto, nessa ordem) |
|---|---|
| Qualquer pessoa em post alheio | **Ocultar para mim** (`olho-off`), **Denunciar post** (`bandeira`) |
| Técnico atual, no post do próprio clube | **Editar legenda e prompts** (`editar`), **Apagar post** (`lixo`, vermelho-texto) |
| Admin (em qualquer post) | **Editar legenda e prompts**, **Fixar no topo** ou **Desafixar** (`fixar`), **Ocultar do feed** ou **Mostrar de novo** (`olho-off`), **Apagar post** (vermelho-texto) |

Todos os menus: folha de baixo com alça, itens de 56 px (ícone 24 + texto 16 peso 500), divisor entre itens, botão fantasma **Cancelar**. O ⋯ do comentário segue a mesma ideia: próprio comentário → **Apagar comentário**; admin → **Ocultar comentário** / **Mostrar de novo** e **Apagar comentário**; qualquer outro → **Denunciar comentário**.

## 6. Denunciar e ocultar para mim

**Denunciar** (post ou comentário): folha de baixo com o título “Denunciar post” (ou “Denunciar comentário”), a frase “O admin recebe a denúncia. Ninguém mais vê quem denunciou.”, o campo **Motivo (opcional)** (3 linhas, até 300 caracteres, contador “0/300”) e os botões **Enviar denúncia** (primário) e **Cancelar**. Depois, o aviso rápido “Denúncia enviada. O admin vai olhar.” Não existe motivo obrigatório nem lista de motivos.

**Ocultar para mim:** um toque no item. O card vira uma linha de 56 px (“Post oculto para você.” + **Desfazer** sublinhado, 6 s) e depois some da lista. Só afeta essa pessoa. Não há tela para rever os ocultos na v1.

| Tela (board) | O que mostra |
|---|---|
| `denunciar-menu` | Menu de um post alheio: Ocultar para mim, Denunciar post, Cancelar |
| `denunciar-folha` | Folha “Denunciar post” com o motivo opcional e o contador |
| `denunciar-enviada` | Feed com o aviso rápido “Denúncia enviada. O admin vai olhar.” |
| `ocultar-para-mim` | Feed com o card recolhido em “Post oculto para você. Desfazer” |
| `denunciar-comentario-menu` | Folha de comentários com o menu “Denunciar comentário” |

## 7. Tela de admin: Denúncias

`/admin/denuncias`, entra por uma linha nova no início da administração (**Denúncias**, com selo vermelho de contagem, entre “Pedidos de troca” e “Código de convite”). Lista as denúncias abertas, da mais antiga para a mais nova (`GET /api/admin/denuncias?abertas=1`). Várias denúncias do mesmo item vêm juntas num cartão (“2 denúncias”, agrupadas no front).

Cartão (358 px, `--im-superficie`, raio 12): chip do tipo (**Post** ou **Comentário**) e o clube; prévia do conteúdo (miniatura de 56 px e as 2 primeiras linhas da legenda, ou o trecho do comentário com o nome de quem comentou); “Denunciado por Erik · há 1 hora”; “Motivo: ofensivo” (ou “Sem motivo”); toque na prévia abre `/p/:id` (o admin vê o oculto). Ações em linha: **Ocultar** (secundário), **Apagar** (fantasma com texto `--im-vermelho-texto`) e **Ignorar** (texto sublinhado, só resolve a denúncia).
- **Ocultar** e **Apagar** também resolvem a denúncia (o front chama ocultar/apagar e depois resolver). Apagar pede o diálogo de confirmação de sempre; ocultar não (é reversível).
- Depois da ação, o cartão some com o aviso rápido (“Post oculto.”, “Post apagado.”, “Denúncia ignorada.”).
- Vazio: “Sem denúncias abertas”. Erro: caixa com **Tentar de novo**.

| Tela (board) | O que mostra |
|---|---|
| `admin-inicio-denuncias` | Início da administração com as 4 linhas e o selo “3” em Denúncias |
| `admin-denuncias` | Dois cartões: um post com miniatura e um comentário |
| `admin-denuncias-vazio` | “Sem denúncias abertas” |

## 8. Hashtags (link na `/tag/:tag`)

Em legenda, texto e comentário, `#palavra` vira link (cor `--im-vermelho-texto`, Inter 600, sem sublinhado) para `/tag/<palavra>` (comparação sem acento e sem diferença de maiúscula). Não vira link: `#` sozinho, `#` dentro de URL (`site.com/#x`), `##` e números puros sem letra. A tela `/tag/:tag` é a grade do clube (3 colunas, 128 px, vão de 3 px) com o cabeçalho “#contratacao” em Barlow Condensed 700 32 e o texto “12 posts” em giz-2 (só mostra o total se já veio). Vazio: “Nenhum post com #contratacao ainda.” Carregando e erro como no clube. Cada capa abre `/p/:id`. Posts ocultados não aparecem.

| Tela (board) | O que mostra |
|---|---|
| `tag-grade` | `/tag/contratacao` com a grade, incluindo um post de texto |
| `tag-vazia` | “Nenhum post com #contratacao ainda.” |

## 9. Favoritos na galeria

- **Estrela** no detalhe do prompt (`perfis.md`): ícone `estrela` de 24 px, alvo 44, no canto superior direito (X de fechar à esquerda). Desligada: traço em giz-2. Ligada: preenchida em `--im-amarelo`, com `aria-pressed="true"` e rótulo “Tirar dos favoritos”. Troca na hora (otimista); se falhar, volta e mostra “Não deu para favoritar. Tente de novo.”
- **Filtro “Favoritos”** na galeria: um segundo chip ao lado do filtro de clube (pílula 40 px, ícone `estrela` + “Favoritos”). Ligado: borda giz 1,5 px e estrela amarela. Combina com o filtro de clube.
- Favoritos são **só da pessoa** (ninguém vê os dos outros).
- Vazio com o filtro: “Nenhum favorito ainda” / “Toque na estrela de um prompt para guardar aqui.” e **Limpar filtro**.

| Tela (board) | O que mostra |
|---|---|
| `galeria-detalhe-favorito` | Detalhe do prompt com a estrela ligada (amarela) |
| `galeria-favoritos` | Galeria com o chip Favoritos ligado e a grade filtrada |
| `galeria-favoritos-vazio` | Sem favoritos |

## 10. Bio e capa do clube

**Perfil do clube** (`perfis.md`) ganha:
- **Capa** de 390 × 130 (3:1) colada no topo, de borda a borda e atrás da área segura. Sobre ela, a seta de voltar num círculo de 36 px `--im-carvao` a 60%. Sem capa: fundo em gradiente `--im-superficie-alta` → `--im-superficie`.
- O escudo (88 px) sobe e **sobrepõe a capa** em 44 px, com anel de 4 px `--im-carvao`. Nome do clube e técnico na linha do escudo, como hoje.
- **Bio** logo abaixo do cabeçalho: Inter 15/22 em giz, até 300 caracteres, corta em 3 linhas com “mais”. Sem bio: visitante não vê nada; o **técnico atual** vê “Adicionar bio” em giz-2 sublinhado, no mesmo lugar.
- **Editar clube** (botão fantasma 40 px, à direita) aparece **só** para o técnico atual e o admin. Ex-técnico e visitantes não veem o botão (nada desabilitado).

**Editar clube** (`/c/:id/editar`, seta de voltar): prévia da capa (358 × 119, raio 12) com o botão central **Trocar capa** (ícone câmera + texto, pílula escura); ajuda “Imagem larga, 3:1. Ela é reduzida no celular antes de enviar.”; campo **Bio do clube** (caixa de 120 px, contador “0/300”); botão fixo **Salvar alterações**.
- A capa é enviada ao escolher (`PUT /api/clubes/:id/capa`, mesmo pipeline das fotos: reduz para 1500 × 500, JPEG ≤ 3 MB) e fica com véu e spinner enquanto sobe. A bio é salva em **Salvar alterações** (`PATCH /api/clubes/:id {bio}`).
- Erros: “Não deu para ler essa imagem. Escolha outra.” (imagem ilegível ou `IMAGEM_INVALIDA`); acima de 300 caracteres o contador e a borda ficam em vermelho-texto e **Salvar** desabilita; `NAO_E_TECNICO` (403): aviso “Você não é mais técnico deste clube.” e campos a 55%.

| Tela (board) | O que mostra |
|---|---|
| `clube-capa-bio` | Perfil do clube com capa, escudo sobreposto, bio de 3 linhas e “Editar clube” (visão do técnico); a grade traz um post de texto |
| `clube-sem-capa` | Sem capa nem bio: gradiente de reserva e o convite “Adicionar bio” (técnico) |
| `clube-editar` | Tela de edição com a capa, “Trocar capa” e a bio com contador |
| `clube-editar-enviando` | Capa com véu e spinner, **Salvar** desabilitado |
| `clube-editar-erro` | Aviso de imagem ilegível e bio com 312/300 em vermelho |

## Regras gerais

- Todos os avisos rápidos: barra de 48 px `--im-superficie-alta`, ícone à esquerda, texto Inter 500 14, 3 s, `role="status"` (erros em `role="alert"`).
- Estados de carregando, vazio e erro dos blocos novos usam os mesmos esqueletos e caixas dos grupos anteriores (`feed.md`, `perfis.md`).
- Nenhuma tela nova exige dependência (emoji do sistema, ícones SVG próprios).

## Pendências para aprovar

1. O ⋯ passa a aparecer em todo post (com “Ocultar para mim” e “Denunciar” para quem não edita), mudando a regra de `feed.md`.
2. Linha “N reações” no lugar de “N curtidas”, e o botão de reagir mostra o emoji escolhido.
3. Toque duplo sempre dá ❤️ (troca a reação, nunca tira); toque curto tira a reação que já existe.
4. Compartilhar no card, à direita da linha de ações; a prévia do link é genérica.
5. Ocultar e Apagar já resolvem a denúncia; **Ignorar** só a resolve.
