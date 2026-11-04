# Pack 2 · Onda C: design (IM-45, Task C0)

Fonte visual: Penpot, página **Pack 2 · Onda C** (52 telas, nomes na tabela de cada seção, em seções rotuladas). Spec: `docs/superpowers/specs/2026-11-04-instamanager-pack2-design.md` (§4.3, 4.4, 4.10, 4.13, 5); plano: `docs/superpowers/plans/2026-11-04-pack2-onda-c.md`. Tudo dentro dos fundamentos (`fundamentos.md`), do card e da barra de `feed.md`, do postar de `postar.md` e `onda-a.md`, da pílula de clube de `perfis.md`. Celular primeiro (390 px); desktop só em Atividade e Busca. Nada novo de cor, fonte ou espaço.

Ícones novos (grade 24, traço 1,75, `currentColor`, **`width="24" height="24"` e `aria-hidden`**, o teste de `front/src/icones.test.ts` exige) em `docs/design/icones/`: `atividade` (sino), `busca`, `play`, `video` (câmera), `volume`, `volume-off`, `olho`. São 7 (o `volume` liga o par do `volume-off`). `play` é de contorno; no botão de play e na capa o front preenche com `fill="currentColor"`. Reaproveitados: `seta`, `fechar`, `voltar`, `lixo`, `alerta`, `imagem`, `camera`, `galeria`, `liga`, `perfil`, `inicio`, `novo-post`.

## 1. Barra nova e topo do feed

**Feed · Liga · + Postar · Atividade · Perfil.** A Galeria sai da barra: vira ícone `galeria` no topo do feed (à direita) e atalho no Perfil. A **Busca** também é ícone no topo do feed, à esquerda da Galeria, e no topo da Galeria. Topo do feed: “InstaManager” (Barlow 800 26, −0,5 px) à esquerda; ícones `busca` e `galeria` (24, alvo 44, vão de 44) à direita.

**Contador da Atividade:** pílula `--im-vermelho` de 18 de altura (24 de largura com “9+”), raio 9, borda de 2 px `--im-superficie` (recorta o sino), número em Barlow 700 13 giz, no canto superior direito do ícone (a +2 px do centro). Sem não lidas: sem pílula. 1 a 9: o número; 10 ou mais: “9+”. Leitor de tela: `aria-label` do item “Atividade, 3 não lidas”. Item ativo giz, inativos giz-2. Cinco alvos de 78 × 64; Postar segue a pílula vermelha de 48 × 32 (sem mudança). Desktop: a lateral de 220 ganha Atividade (com o contador à direita) e Busca; ordem Feed, Liga, Postar, Galeria, Atividade, Busca, Perfil.

| Tela | O que mostra |
|---|---|
| `feed-topo-barra` | Topo com busca e galeria, faixa de stories, card de vídeo e a barra com contador “3” |
| `barra-contador` | Os três estados do contador: nenhum, 3, “9+” |

## 2. Atividade (`/atividade`)

Título “Atividade” (Barlow 800 26). Abrir a tela **marca tudo como lido** (`POST /api/atividade/lidas`), mas nesta visita os itens que eram novos continuam destacados até sair da tela. Duas seções: **Novas** e **Mais antigas** (Barlow 600 20). Paginação por `antes=` com rolagem.

**Item** (72 de altura, divisor de 1 px `--im-linha`): avatar 44 à esquerda com **selo do tipo** (círculo 20 `--im-superficie`, borda 2 `--im-carvao`, ícone 14 traço 2) no canto inferior direito; texto Inter 14/18 em até 2 linhas com o nome em 600; embaixo a data em `legenda` giz-2 (12); à direita a **miniatura 44 × 44** do post (raio 8). **Não lida**: fundo `--im-superficie` e ponto `--im-vermelho` de 8 px na borda esquerda (16 px de margem). Item inteiro é o alvo de toque e abre o destino: post (`/p/<id>`), perfil (CBF), votação, ou o clube (troca).

| Tipo | Selo | Texto | Destino |
|---|---|---|---|
| `REACAO` | `reacao` | “Paulo reagiu ao post do Santos” | post |
| `COMENTARIO` | `comentar` | “Marcos comentou: “…”” (até 80 caracteres, corta com …) | post (abre os comentários) |
| `MENCAO` | `perfil` | “Rafa mencionou você: “…”” | post |
| `CBF_CITOU` | escudo da CBF 36 × 44 no lugar do avatar, selo `liga` | “CBF citou você no comunicado da rodada 11” | post da CBF |
| `TROCA_DECIDIDA` | círculo 44 com `ok` em `--im-gramado` (aprovada) ou `alerta` em vermelho-texto (recusada), sem avatar | “Seu pedido pelo Vasco foi aprovado. O clube é seu.” | `/c/:id` |
| `VOTACAO_RESULTADO` | círculo 44 com `votacao` | “Resultado de Técnico do mês: venceu o Palmeiras.” | `/votacoes/:id` |

**Post indisponível** (ocultado ou apagado): o item fica, a miniatura vira quadrado com `imagem` em giz-3, o texto não traz legenda nem comentário (“Dani reagiu a um post”) e a data vira “Post indisponível · 3 dias”. O toque não leva a lugar nenhum.

| Tela | O que mostra |
|---|---|
| `atividade` | Novas (3 destacadas) e antigas, todos os 6 tipos mais o indisponível |
| `atividade-vazia` | Caixa “Nada por aqui ainda” + “Quando alguém reagir ao post do seu clube, comentar ou mencionar você, aparece aqui.” (sem botão) |
| `atividade-carregando` | 8 esqueletos (avatar, 2 linhas, miniatura), pulso de 1,2 s, parado em `prefers-reduced-motion` |
| `atividade-erro` | Caixa “Não deu para carregar a atividade” e **Tentar de novo** |
| `desktop-atividade` | Lateral de 220 + coluna de 640 com a lista |

## 3. @menções

Digitar `@` num comentário, legenda ou post de texto abre a **lista de pessoas** presa logo acima do campo (no comentário) ou do cursor (legenda/texto), de 8 pessoas no máximo, raio 14, fundo `--im-superficie-alta`, borda `--im-linha`. Linha de 52: avatar 36, nome em Inter 15 (a parte digitada em 700), pílula do clube à direita (“torcedor” se não tiver clube). A linha ativa tem fundo `--im-superficie`. Toque numa linha insere o **chip** e o cursor segue depois dele com um espaço. A busca começa com 2 letras (`GET /api/pessoas?q=`), com atraso de 250 ms entre teclas.

**Chip**: altura 22, raio 6, padding 7 por 3, fundo `--im-superficie-alta`, texto “@Nome” em Inter 600 no tamanho do texto ao redor (no post de texto grande: Barlow 700 24, altura 36, raio 8). Guardado como `@[Nome](uuid)`; o nome mostrado vem do banco (`mencoes` do post/comentário). Toque abre o perfil da pessoa (alvo de 44 com área invisível). Dentro do campo, apagar uma vez remove o chip inteiro. Id que não existe mais vira texto cinza `--im-giz-3` “@pessoa removida”, sem toque. Limite: 10 menções por texto; na 11ª a lista não abre e o campo avisa “No máximo 10 menções”.

| Tela | O que mostra |
|---|---|
| `mencao-autocompletar` | “Boa, @Pa” com Paulo, Paula e Pablo (torcedor) e o teclado |
| `mencao-dica-2-letras` | Só “@”: “Digite 2 letras do nome para buscar uma pessoa.” |
| `mencao-sem-resultado` | “Ninguém com “zzq” no nome.” e a ajuda de grafia |
| `mencao-chip-inserido` | Chip dentro do campo depois da escolha |
| `mencao-chip-no-texto` | Chip na legenda, no comentário, no post de texto e “@pessoa removida”, com as medidas |

## 4. Busca (`/busca`)

Abre pelo ícone no topo do feed e da galeria. Campo de 44 de altura, raio 22 (pílula), `--im-superficie`, borda `--im-linha`; **foco**: borda 2 px `--im-giz`. Ícone `busca` à esquerda, `fechar` (limpar) à direita quando há texto, e **Cancelar** (Inter 500 14) ao lado, que volta de onde veio. Abaixo, abas **Posts · Prompts · Clubes · Pessoas** no mesmo controle de 40 px da Liga (aba ativa `--im-superficie-alta` com borda `--im-giz-3`). A busca dispara com 2 caracteres ou mais (60 no máximo), 300 ms depois da última tecla, e a aba escolhida fica ao trocar de termo. O trecho que casou fica em 700 giz; o resto giz-2 (casa sem acento e sem diferenciar maiúscula, então “contratacao” destaca “Contratação” inteiro).

Resultados (20 por página, rolagem infinita):
- **Posts:** miniatura 64 (escudo no post de texto) + clube em Barlow 700 18 + 2 linhas de legenda com o destaque + data. Toque abre `/p/:id`.
- **Prompts:** miniatura 64 com `imagem`, o prompt em 2 linhas e “por Lincoln”, seta. Toque abre o item da galeria.
- **Clubes:** escudo 44, nome (Barlow 700 20), “técnico Lincoln · 3º na Liga” (ou “vaga aberta”), seta. Sem a CBF.
- **Pessoas:** avatar 44, nome (a parte digitada em 700), pílula do clube à direita. Toque abre o perfil.

| Tela | O que mostra |
|---|---|
| `busca-inicio` | Campo com foco e teclado: “Digite ao menos 2 letras” + o que a busca olha |
| `busca-1-letra` | 1 caractere: aviso âmbar “Falta mais uma letra para buscar.” (não chama a API) |
| `busca-posts`, `busca-prompts`, `busca-clubes`, `busca-pessoas` | Uma tela por aba, com destaque |
| `busca-sem-resultado` | Caixa “Nada achado para “xzqw”” + “Tente outra palavra. A busca ignora acento e maiúscula.” |
| `busca-carregando` | 5 esqueletos de linha |
| `busca-erro` | “Não deu para buscar” e **Tentar de novo** |
| `desktop-busca` | Lateral de 220 + coluna de 576 |

## 5. Stories

### 5.1 Faixa no topo do feed

Altura 104, abaixo do topo e acima do primeiro card, rolável na horizontal (sem barra), vão de 16 entre bolinhas, 16 de margem. **Bolinha**: 64 com escudo de 48, anel de 3 px em volta a 4 px (`--im-vermelho` = **não visto**; `--im-linha` de 2 px = **visto**), nome do clube em Inter 500 12 embaixo (corta com …, 72 de largura máx.). Ordem: **Seu story** primeiro (só o técnico atual; escudo com o **+** vermelho de 24 no canto, toque cria um story; se já tem story ativo, mostra o anel e o toque abre o visualizador, e o + passa a ficar só no visualizador), **CBF** (escudo da CBF 32 × 44 dentro da bolinha, sempre com o anel vermelho se há story novo), depois os clubes com story não visto (do mais novo ao mais velho), depois os vistos. Sem nenhum story: a faixa some (e o técnico atual continua vendo “Seu story”). Carregando: 5 círculos de esqueleto. Erro: a faixa some em silêncio (o feed segue).

### 5.2 Visualizador (`/stories/:clubeId`)

Tela cheia sobre `--im-carvao`, mídia centralizada (imagem ou vídeo, “contain”). Topo com um degradê preto 35% de 150 px:
- **Barras de progresso** de 3 px, raio 1,5, vão de 4, uma por story do clube (giz = visto e atual, giz 30% = por ver). Imagem dura 5 s; vídeo dura a duração do vídeo.
- Escudo 36, nome em Barlow 700 18 e “por Paulo · há 3 h” em Inter 12.
- **Botão de som** (só em story de vídeo): círculo de 40 `#000` a 50% com `volume-off` (mudo) ou `volume` (ligado), à esquerda do X; alvo de 44. **O vídeo começa mudo.** Na primeira vez da sessão aparece abaixo uma dica em pílula “Sem som. Toque no alto-falante para ligar.” que some em 4 s. A escolha de som vale para os próximos stories da sessão. Story de imagem não mostra o botão.
- **X** de 24 (alvo 44) à direita.

Gestos: tocar no terço direito avança, no esquerdo volta; **segurar** pausa (a interface do topo some e as barras param); **arrastar para baixo** fecha (a tela encolhe e escurece, “Solte para fechar”). Ao acabar o último story do clube, segue para o próximo clube da faixa; no último, fecha. Marca o story como visto (`PUT /api/stories/:id/visto`) ao abrir.

**Autor** (técnico do clube, admin): barra de baixo com degradê, `olho` e “Visto por 8”, `lixo` (apagar, com confirmação “Apagar este story?”) e uma seta para cima. Tocar em “Visto por” **pausa o story** e abre a folha de 544 com a lista (avatar 44, nome em 600, pílula do clube; 64 de altura por linha), título “Visto por 8”.

| Tela | O que mostra |
|---|---|
| `story-visualizador` | Vídeo mudo (botão `volume-off` e a dica) |
| `story-visualizador-som-ligado` | Mesmo story com `volume` |
| `story-visualizador-imagem` | Story de imagem, sem botão de som |
| `story-visualizador-pausado` | Segurando: sem cabeçalho, barras paradas |
| `story-visualizador-fechando` | Arrastando para baixo |
| `story-visualizador-autor` | “Visto por 8” e lixeira |
| `story-vistos` | Folha com a lista de quem viu |
| `story-carregando` | Barras em 0 e spinner de 48 (arco de 90°) no centro |
| `story-erro` | Caixa “Não deu para abrir este story” + **Tentar de novo** |
| `story-expirado` | `404`: “Esse story já saiu do ar” + **Voltar ao feed** (“Stories ficam 24 horas.”) |

### 5.3 Criar story (`/stories/novo`)

Aberto pelo **+** do “Seu story” ou do perfil do clube. Só técnico atual e admin; o torcedor cai em `criar-story-erro-sem-permissao`.

1. **Escolher** (`criar-story-escolher`): X, título “Novo story”, “Vai sair como Santos, por Lincoln. Some em 24 horas.” e dois cartões de 120: **Foto** (ícone `camera`, “JPEG de até 3 MB. Reduzida no celular antes de enviar.”) e **Vídeo** (ícone `video`, “Até 30 s e 60 MB. O app converte para tocar em qualquer celular.”). Cada um abre o seletor do celular (`accept="image/jpeg,image/png,image/webp"` e `accept="video/*"`).
2. **Prévia** (`criar-story-previa`): a mídia em tela cheia, pílula de duração “0:18” (câmera + Barlow 600 15) embaixo à esquerda, botão de som no canto (mudo por padrão), **Publicar story** (primário) e **Escolher outro** (secundário). Admin vê o interruptor **Postar como CBF** (`criar-story-previa-admin`, cartão de 52 com toggle de 48 × 28).
3. **Enviando** (`criar-story-enviando`): cartão sobre a prévia com “Enviando vídeo…”, barra de 8 px (`--im-vermelho`), “62%” e “23 de 37 MB”, “Não feche o app até terminar.” e **Cancelar envio**.
4. **Convertendo** (`criar-story-convertendo`): “Convertendo vídeo…”, barra **indeterminada** (trecho vermelho que desliza; parada em `prefers-reduced-motion`), “O envio acabou. Agora o servidor prepara o vídeo para tocar em qualquer celular. Leva até 1 minuto.” e **Cancelar**. Foto não passa por essa etapa.
5. Publicado: volta ao feed com a bolinha em “Seu story” e o aviso rápido “Story publicado”.

Erros (caixa com borda `--im-vermelho-texto` e botão **Escolher outro vídeo**): `criar-story-erro-longo` (400 `VIDEO_LONGO`: “Esse vídeo tem 31 s / O limite do story é 30 s. Corte o vídeo na galeria do celular e escolha de novo.”), `criar-story-erro-invalido` (422 `VIDEO_INVALIDO`: “Não deu para ler esse vídeo”), `criar-story-erro-grande` (413: “Esse arquivo passa de 60 MB”) e `criar-story-erro-sem-permissao` (403: “Só técnico de clube posta story”, botão **Ver clubes livres**). O front confere o tamanho e a duração antes de enviar quando consegue, e os mesmos textos valem para a resposta do servidor.

## 6. Postar com vídeo

Em `/postar` o controle de alternância passa de **Foto | Texto** para **Foto | Texto | Vídeo** (3 segmentos de 44, no mesmo lugar). Um post tem **ou** imagens **ou** 1 vídeo, então trocar de aba com conteúdo pede o diálogo de descartar de `postar.md`.

| Tela | O que mostra |
|---|---|
| `postar-foto-alternancia-3` | Passo 1 com a aba Foto e os três segmentos |
| `postar-video-vazio` | Aba Vídeo: área tracejada, “Vídeo do celular”, “MP4 ou MOV, até 30 s e 60 MB. O iPhone grava em MOV: tudo bem, o app converte.”, **Escolher vídeo**; **Continuar** desabilitado |
| `postar-video-escolhido` | Capa 358 × 358 com play e duração, nome do arquivo, “0:24 · 38 MB · converte ao publicar”, **Trocar vídeo**, **Continuar** |
| `postar-video-legenda` | Passo 2: miniatura 96, “Vídeo de 24 s”, “Vídeo não tem prompt e não aparece na galeria.”, campo Legenda (aceita @ e #), **Publicar** |
| `postar-video-enviando` | Passo 3: “Publicando…”, barra de bytes “62%” e “23 de 37 MB”, **Cancelar envio** |
| `postar-video-convertendo` | “Convertendo vídeo…”, barra indeterminada e “Isso leva até 1 minuto. Se você sair agora, o post não é publicado.” |
| `postar-video-erro-longo`, `-invalido`, `-grande` | Mesmos erros do story; a miniatura ganha borda vermelha |

O envio falho e a falta de permissão reaproveitam `envio-falhou` e `envio-sem-permissao` de `postar.md`.

## 7. Card de post com vídeo

Igual ao card de `fundamentos.md` (cabeçalho, ações, contagem, legenda), com a **capa** no lugar da imagem (390 × 390, a proporção quadrada do feed):
- **Play** no centro: círculo de 64 `#000` a 55% com `play` de 28 preenchido em giz. Toque inicia o vídeo no lugar, **mudo** (autoplay só depois do toque; sem som até a pessoa ligar).
- **Duração** embaixo à esquerda: pílula de 28 `#000` a 65% com `video` (20) e “0:24” em Barlow 600 15. Quando toca, mostra o tempo que falta/passou (“0:11”).
- **Som** embaixo à direita: círculo de 36 `#000` a 65% com `volume-off` (24); ligado vira `volume`. Alvo de 44.
- Tocando: o play some e uma barra de progresso de 3 px (giz sobre `--im-superficie-alta`) corre na base da mídia. Toque no vídeo pausa/retoma; sair da tela do feed pausa.
- Sem selo “Ver prompt” e sem contador “1/3”. Vídeo que falha ao tocar volta à capa com `alerta` e “Não deu para tocar. Toque para tentar de novo.”.

| Tela | O que mostra |
|---|---|
| `card-video` | Capa com play, “0:24” e som desligado |
| `card-video-tocando` | Tocando em 0:11, som ligado, barra de progresso |

## Tokens usados (nenhum novo)

`--im-carvao`, `--im-superficie`, `--im-superficie-alta`, `--im-linha`, `--im-giz`, `--im-giz-2`, `--im-giz-3`, `--im-vermelho`, `--im-vermelho-texto`, `--im-gramado`, `--im-amarelo`. Só duas cores fixas, nas capas de exemplo: `#16231B` (capa) e `#2E4A38` (linhas da capa); no app a capa é o JPG gerado pelo back. Sobreposições: `#000` com 35% (degradê do topo), 50 a 65% (botões sobre a mídia).
