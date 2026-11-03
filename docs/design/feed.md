# Grupo 2: feed, comentários e barra inferior (IM-19, Task D2)

Telas do feed, card de post com carrossel, curtir, comentários, menu do post e barra inferior. Fonte visual: Penpot, página **Feed (D2-2)** (19 telas, com os mesmos nomes da tabela abaixo). Tokens, tipografia e componentes base: `docs/design/fundamentos.md`. Nada novo de cor, fonte ou espaço neste grupo.

## Barra inferior (celular)

Itens, nesta ordem: **Feed**, **Galeria**, **Postar**, **Clube**, **Perfil**. Não existe item de notificações: o app só avisa por push e não tem tela para isso.

- Altura 98 px = 64 px da barra + 34 px de área segura do iPhone (`padding-bottom: env(safe-area-inset-bottom)`). Fundo `--im-superficie`, borda superior 1 px `--im-linha`, fixa no fim da tela.
- 5 colunas iguais (78 px). Cada item: ícone de 24 px (`inicio`, `galeria`, `novo-post`, `escudo`, `perfil`) e rótulo `micro` de 12 px embaixo. Alvo de toque = coluna inteira × 64 px.
- Ativo: ícone e rótulo em `--im-giz`, ícone com traço 2,1 px, rótulo peso 600. Inativo: ícone e rótulo em `--im-giz-2` (o `--im-giz-3` não passa no contraste para texto de 12 px).
- **Postar** é o único com destaque: pílula 48 × 32 em `--im-vermelho`, raio 10, ícone `novo-post` em giz com traço 2 px. Rótulo sempre giz.
- Mesma barra para todo mundo (técnico, torcedor, admin). O torcedor que toca em **Postar** vê a folha `postar-bloqueado`.
- Marcação: `<nav aria-label="Principal">`, item ativo com `aria-current="page"`. Clube leva ao perfil do clube da pessoa; sem clube, vira a lista de clubes (grupo 4).

## Cabeçalho do feed

Altura 56 px abaixo da área segura de cima (47 px no iPhone), fundo `--im-carvao`, divisor de 1 px `--im-linha`. Só a marca: ícone do app 32 px + “InstaManager” em Barlow Condensed 800, 28 px. Sem botões (não há busca, mensagem nem notificação na v1).

## Card de post

Medidas e anatomia estão em `fundamentos.md`. Regras novas deste grupo:

- **Proporção da imagem:** o quadro do carrossel usa a proporção da **primeira** imagem (`largura`/`altura` da API), limitada entre 4:5 (retrato, 390 × 488) e 1,91:1 (paisagem). Fora do limite, corta o quadro e a imagem fica inteira (`object-fit: contain`) sobre `--im-superficie-alta`. As demais imagens do post ficam inteiras no mesmo quadro. Isso evita pulo de layout: reservar a altura com `aspect-ratio` antes de carregar.
- **Carrossel:** arrastar na horizontal com encaixe (`scroll-snap-type: x mandatory`). Contador “2/3” (pílula escura a 72%, canto superior direito) e pontinhos de 6 px (ativo giz, demais giz-3) só quando há mais de uma imagem. Desktop: setas laterais de 36 px ao passar o mouse.
- **Ver prompt:** pílula escura no canto inferior esquerdo, só nas imagens com prompt. Toque abre o detalhe da galeria daquela imagem (grupo 4). A etiqueta muda com a imagem visível.
- **Curtir:** toque no coração (24 px, alvo 44) ou duplo toque na imagem (só curte, nunca descurte). Curtido = coração `--im-vermelho` cheio, contagem muda na hora (otimista; se a API falhar, desfaz e mostra o aviso “Não deu para curtir. Tente de novo.”). Animação: o coração cresce a 125% e volta em 180 ms; com `prefers-reduced-motion` só troca de cor. Contagem em Barlow Condensed 600: “1 curtida” no singular, “128 curtidas” no plural, nada quando é 0 (some a linha).
- **Comentários:** o ícone e o texto “Ver os 14 comentários” abrem a folha de comentários. Com 0 comentários, o texto vira “Comentar” em giz-2.
- **Legenda:** nome do técnico em `corpo-forte`, texto em `corpo`, corta em 3 linhas com “mais” em giz-2 (toque expande no lugar).
- **Toques:** clube (escudo e nome) → perfil do clube; “por Lincoln” não é link na v1.
- **Imagens:** no feed usa `miniUrl` (a 390 px); primeira imagem do primeiro post `loading="eager"`, as demais `loading="lazy"`; as outras imagens do carrossel só carregam ao chegar perto.

## Quem vê o ⋯ (editar e apagar)

O ⋯ no cabeçalho do card aparece **somente** quando a API manda `podeEditar: true` (técnico atual do clube ou admin). Para os outros casos o controle não existe:
- torcedor (sem clube),
- ex-técnico do clube (o poder acaba quando sai, os posts dele ficam no clube),
- técnico de outro clube.

Sem botão cinza, sem item desabilitado e sem aviso: o card só não tem o ⋯, e o cabeçalho respira igual. (Board `feed-sem-editar`.) O mesmo vale para o ⋯ do comentário: só na própria pessoa e, para o admin, em todos.

**Menu do post** (`post-menu`): folha de baixo com “Editar legenda e prompts” (abre os mesmos campos de legenda e prompt do novo post, grupo 3; imagens não mudam) e “Apagar post” em `--im-vermelho-texto`, mais o botão fantasma **Cancelar**. **Apagar** abre o diálogo `apagar-confirmar` (342 px, raio 16): “Apagar este post?” / “As imagens, as curtidas e os comentários também somem. Não dá para desfazer.” com **Apagar post** (primário) e **Manter post** (secundário). Depois de apagar, o card sai da lista e aparece o aviso rápido “Post apagado” (barra `--im-superficie-alta` acima da barra inferior, 3 s).

## Comentários

Folha que sobe sobre o feed (`comentarios`), com o feed escurecido a 60% atrás.

- Altura 680 px (80% da tela), topo com raio 20, alça de 40 × 4. Título “Comentários” em `titulo-2` 24 + contagem em giz-2. X de fechar (24 px, alvo 44) à direita. Arrastar para baixo também fecha. Foco e Esc fecham no desktop.
- Cada comentário: avatar 32 px (inicial se não houver foto), nome em `corpo-forte` 14, **pílula do clube atual** da pessoa ao lado do nome (mini: 20 px de altura, escudo 12 px + sigla 13 px; sem clube = sem pílula), texto em `corpo` 15, hora em `legenda` 12 giz-2, do mais velho ao mais novo (abre rolado até o último). Sem resposta encadeada.
- Campo fixo embaixo (76 px): avatar da própria pessoa, caixa em `--im-superficie-alta` com raio total (placeholder “Comente como Lincoln” em giz-3), “Publicar” à direita (giz-3 vazio; `--im-vermelho-texto` quando há texto). Sobe junto com o teclado. Limite 1000 caracteres: a partir de 900 aparece “950/1000” em giz-2. Torcedor também comenta.
- **Envio otimista:** o comentário aparece na hora a 55% com “Enviando…”. Se falhar, vira “Não enviou. Toque para tentar de novo.” em `--im-vermelho-texto` (o texto fica guardado). Em sucesso, volta a 100%.
- **Apagar** (`comentario-menu`): ⋯ do comentário abre uma folha pequena com “Apagar comentário” (vermelho-texto) e Cancelar. Sem confirmação extra.
- Estados: `comentarios-vazio` (“Ainda ninguém comentou” / “Seja o primeiro a mandar um recado.”), `comentarios-carregando` (4 linhas de esqueleto), `comentarios-erro` (“Não deu para carregar os comentários”, botão **Tentar de novo**; o campo de comentar continua ativo).
- Desktop: a folha vira janela central de 390 × 660 com fundo escurecido (`desktop-comentarios`).

## Telas

| Tela (board) | O que mostra |
|---|---|
| `feed` | Cabeçalho, card (imagem quadrada, 1/3, Ver prompt, ⋯ de técnico), barra inferior com Feed ativo |
| `feed-carrossel` | Segunda imagem de 3 (2/3), proporção 4:5, curtido (129 curtidas), card sem ⋯ |
| `feed-sem-editar` | Post de outro clube, imagem única (sem contador e sem pontos), sem Ver prompt, **sem ⋯** |
| `post-menu` | Menu do post: Editar legenda e prompts, Apagar post, Cancelar |
| `apagar-confirmar` | Diálogo de confirmação ao apagar |
| `comentarios` | Folha com 4 comentários (um da própria pessoa com ⋯) e campo em foco |
| `comentarios-vazio`, `comentarios-carregando`, `comentarios-erro` | Estados da folha |
| `comentarios-envio` | Um comentário enviando (55%) e um que falhou (“Não enviou…”) |
| `comentario-menu` | Folha “Apagar comentário” |
| `feed-carregando` | Esqueleto do card com a mesma altura, pulsando |
| `feed-vazio-tecnico` | “Ainda não tem post por aqui” + botão **Novo post** |
| `feed-vazio-torcedor` | Mesmo texto + “Só técnico de clube posta…” + botão secundário **Ver clubes livres** (leva a pedir um clube, grupo 5) |
| `feed-erro` | “Não deu para carregar o feed” + **Tentar de novo** |
| `feed-erro-mais` | Falha na rolagem: posts já carregados ficam e o aviso “Não deu para carregar mais posts.” + **Tentar de novo** aparece no fim da lista |
| `postar-bloqueado` | Folha “Só técnico posta”: texto, **Ver clubes livres** e **Agora não** |
| `desktop-feed`, `desktop-comentarios` | Versão ≥ 768 px |

## Lista, paginação e atualização

- Ordem cronológica, do mais novo ao mais velho, 12 posts por página (`GET /api/posts?antes=`). Carregar a próxima página quando faltarem 2 cards para o fim. Fim da lista: “Você viu tudo por aqui.” em `legenda` giz-3, centralizado.
- Puxar para atualizar no topo usa o esqueleto do card. Ao voltar de outra aba, não recarrega sozinho.
- Posição de rolagem do feed é guardada ao abrir um perfil ou a galeria e volta ao retornar.
- Não há aviso de “novos posts” na v1 (o push já cobre).

## Desktop (a partir de 768 px)

A barra inferior vira **barra lateral esquerda de 220 px** (`barra-lateral`): ícone do app 40 px + nome (Barlow Condensed 800, 24), depois os 5 itens em linhas de 48 px com ícone e rótulo (Inter 16). Ativo: fundo `--im-superficie-alta`, raio 10. **Postar** é uma linha vermelha cheia (`--im-vermelho`). Coluna do feed centralizada com no máximo 470 px (imagem 470 × 470). Entre 768 e 1099 px a lateral pode ficar só com ícones (72 px) se faltar espaço; a partir de 1100 px usa a de 220 px.

## Acessibilidade

- Curtir: `<button aria-pressed>` com `aria-label` “Curtir” / “Descurtir”; a contagem é uma região `aria-live="polite"`.
- Carrossel: `role="group" aria-roledescription="carrossel"`, cada imagem com `aria-label="Imagem 2 de 3"` e texto alternativo = início da legenda (ainda que as imagens sejam geradas por IA).
- Folha de comentários: `role="dialog" aria-modal="true"`, foco vai para o campo ao abrir, volta ao botão que abriu ao fechar.
- Avisos de erro em `role="alert"`; esqueleto e animação do coração respeitam `prefers-reduced-motion`.

## Pendências para o Fabio aprovar

1. Barra inferior sem notificações (já decidido) e com rótulos visíveis embaixo de cada ícone.
2. Altura do quadro do carrossel seguindo a primeira imagem, entre 4:5 e 1,91:1.
3. Duplo toque na imagem para curtir (só curte, não descurte).
4. Torcedor que toca em **Postar** vê uma folha explicando e levando a pedir um clube, em vez de o item sumir.
5. Quem não pode editar não vê o ⋯ (nada desabilitado).
