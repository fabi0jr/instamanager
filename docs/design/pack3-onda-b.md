# Pack 3 · Onda B: design (IM-60, Task B0)

Fonte visual: Penpot, página **Pack 3 · Onda B** (nomes nas tabelas). Plano: `docs/superpowers/plans/2026-11-05-pack3-onda-b.md` (Global Constraints: níveis, 8 conquistas, regra das respostas). Tudo dentro dos fundamentos (`fundamentos.md`), do perfil (`perfis.md`, `pack3-onda-a.md` §1), da atividade (`onda-c.md` §2) e da folha de comentários (`feed.md`). Celular primeiro (390 px); desktop só na grade de conquistas. **Nada novo de cor, fonte ou espaço.**

Ícones novos (grade 24, traço 1,75, `currentColor`, `width="24" height="24"` e `aria-hidden`, como exige `front/src/icones.test.ts`) em `docs/design/icones/`: `trofeu` (conquista), `nivel` (três barras), `responder` (seta curva). Reaproveitados nas 8 conquistas: `bola`, `estrela`, `escudo`, `liga`, `camera`, `comentar`, `bandeira`.

## Tokens usados (todos já existem)

`--im-carvao`, `--im-superficie`, `--im-superficie-alta`, `--im-linha`, `--im-giz`, `--im-giz-2`, `--im-giz-3`, `--im-vermelho-texto` (erro), `--im-gramado` (conquistada, XP ganho), `--im-amarelo` (só o troféu da conquista nova). Raios `--im-r-btn` 10, `--im-r-midia` 12, `--im-r-pilula`. Texto: `titulo-3`, `corpo`, `corpo-forte`, `legenda`, `micro`.

## 1. Selo de nível (`/u/:id` e `/perfil`)

Fica logo abaixo da pílula do clube, acima de “Clubes por onde passou” (`/u/:id`) e acima do grupo Conta (`/perfil`). Card de 358 × 84, `--im-superficie`, raio 12, borda `--im-linha`, padding 16.
- Linha de cima: `nivel` (24, giz) + nome do nível em Barlow 700 24 (“Técnico”); à direita o XP em Barlow 600 20 giz (“412 XP”).
- Barra de XP: trilho 8 de altura, raio 4, `--im-superficie-alta`; preenchimento `--im-gramado`. Largura = (xp − min) / (proximo − min).
- Linha de baixo (`legenda` giz-2): “Faltam 288 XP para Professor”. Na **Lenda** (`proximo` nulo): barra cheia e “Nível máximo”.
- Níveis: Estagiário 0 · Auxiliar 100 · Técnico 300 · Professor 700 · Lenda 1500.
- Acessibilidade: `role="progressbar"`, `aria-valuenow` = XP no nível, `aria-label` “Técnico, 412 de 700 XP”.
- No `/perfil` o card é o mesmo e abre `/u/:id` da própria pessoa.

| Tela | O que mostra |
|---|---|
| `nivel-selo` | Técnico com 412 XP, barra a 39% |
| `nivel-selo-novato` | Estagiário com 0 XP, barra vazia, “Faltam 100 XP para Auxiliar” |
| `nivel-selo-lenda` | Lenda, barra cheia, “Nível máximo” |
| `nivel-carregando` | Esqueleto do card, pulso de 1,2 s (parado em `prefers-reduced-motion`) |

Erro: o card some e o perfil segue (o nível é complemento); só o erro do perfil inteiro mostra a caixa de `pack3-onda-a.md`.

## 2. Grade de conquistas

Seção **Conquistas · 3 de 8** (Barlow 600 20) depois do selo. Grade de 2 colunas de 175 × 96 com vão de 8 no celular (3 colunas de 208 × 96 no desktop de 640). Ordem fixa: Primeira vitória, Goleada, Invicto, Líder, Campeão da Copa, Rei do bolão, Primeiro story, Comunicador.

Cada célula: `--im-superficie`, raio 12, borda `--im-linha`, padding 12. Ícone 24 no topo, nome em Inter 14/600, regra em `legenda` giz-2 (até 2 linhas).
- **Conquistada:** ícone e borda 1,5 px `--im-gramado`, nome giz, e a data “em 03/11/2026” no lugar da regra.
- **Falta:** ícone `--im-giz-3`, nome giz-2, regra visível (“Vença por 3 gols ou mais.”). O estado nunca é só cor: conquistada traz o texto “em <data>”, a que falta traz a regra.
- **Rei do bolão repetido:** selo “×3” (Barlow 700 16, giz) no canto superior direito, pílula 28 × 22 `--im-superficie-alta`. Com 1 vez, sem selo.

| Tipo | Nome | Ícone | Regra (célula bloqueada) |
|---|---|---|---|
| `PRIMEIRA_VITORIA` | Primeira vitória | `bola` | Vença seu primeiro jogo. |
| `GOLEADA` | Goleada | `estrela` | Vença por 3 gols ou mais. |
| `INVICTO_5` | Invicto | `escudo` | 5 jogos seguidos sem perder. |
| `LIDER` | Líder | `liga` | Feche uma rodada em 1º. |
| `CAMPEAO_COPA` | Campeão da Copa | `trofeu` | Vença a final da Copa. |
| `REI_BOLAO` | Rei do bolão | `bandeira` | Maior pontuação numa rodada. |
| `PRIMEIRO_STORY` | Primeiro story | `camera` | Publique seu primeiro story. |
| `COMUNICADOR` | Comunicador | `comentar` | Publique 100 posts. |

| Tela | O que mostra |
|---|---|
| `conquistas-grade` | 3 conquistadas (uma é Rei do bolão ×3) e 5 em cinza |
| `conquistas-vazia` | Nenhuma: 8 em cinza e, abaixo, “Poste, vença e palpite para ganhar a primeira.” |
| `conquistas-completa` | As 8 coloridas |
| `conquistas-carregando` | 6 células de esqueleto |
| `desktop-conquistas` | Perfil em coluna de 640, grade em 3 colunas |

## 3. Atividade: `CONQUISTA` e `RESPOSTA`

Mesmo item de 72 de `onda-c.md` (não lida: fundo `--im-superficie` e ponto vermelho).

| Tipo | Avatar e selo | Texto | Destino |
|---|---|---|---|
| `CONQUISTA` | círculo 44 `--im-superficie-alta` com `trofeu` em `--im-amarelo`, sem avatar | “Você conquistou Goleada.” (nome da conquista em 600) | `/u/:id` da própria pessoa |
| `RESPOSTA` | avatar de quem respondeu 44, selo `responder` | “Marcos respondeu: “…”” (até 80 caracteres, corta com …) | post, com a folha de comentários aberta |

Quando a conquista é de outra pessoa, não vira item (só do próprio autor); o mundo vê o post da CBF. O post da CBF é de texto, nos moldes dos de `pack3-onda-a.md`: “🏆 @Marcos conquistou *Goleada*!”, com a menção levando ao `/u/:id`.

| Tela | O que mostra |
|---|---|
| `atividade-conquista-resposta` | Um `CONQUISTA` novo e um `RESPOSTA` lido, entre os demais tipos |
| `atividade-resposta-indisponivel` | Resposta a post ocultado: miniatura com `imagem`, “Post indisponível · 3 dias”, sem toque |

## 4. Respostas na folha de comentários

Um nível só. Dentro da folha de `feed.md` (680 de altura, campo fixo de 76).
- **Resposta:** recuo de 40 px à esquerda (alinha com o texto do comentário raiz), avatar 28 (em vez de 32), restante igual. Uma linha-guia de 2 px `--im-linha` desce do avatar do raiz até a última resposta. Texto começa com a menção `@Fulano` em `--im-vermelho-texto` 600 (é link para `/u/:id`).
- **Botão Responder:** texto Inter 600 13 giz-2 com `responder` 16 à esquerda, na linha da hora (“há 2 h · Responder”), alvo 44 de altura (área estendida, o visual segue 13). Em cada comentário, raiz ou resposta.
- **Sem “ver respostas”:** as respostas já aparecem sob o raiz, da mais velha à mais nova. Acima de 3 respostas, as duas últimas ficam visíveis e o link “Ver mais 4 respostas” (`legenda` 600 giz-2) abre o resto no lugar.
- **Aviso “Respondendo a Fulano ✕”:** faixa de 40 acima do campo (`--im-superficie-alta`, borda de cima `--im-linha`), texto `legenda` giz-2 com o nome em giz 600, `fechar` 16 à direita (alvo 44). Ao tocar **Responder**: a faixa aparece, o foco vai ao campo e o campo vem preenchido com `@Fulano ` (o cursor depois do espaço). O ✕ cancela a resposta, limpa a menção e volta a comentar no post. O campo continua acima da barra no iPhone, sobe com o teclado, e a faixa sobe junto.
- **Placeholder:** “Responda a Fulano” (giz-3). Publicar segue giz-3 vazio e `--im-vermelho-texto` com texto; limite 1000 igual.
- **Responder uma resposta:** a faixa diz “Respondendo a Rafa” e a nova resposta cai no mesmo nível, sob o raiz.
- **Comentário raiz oculto ou apagado:** as respostas somem junto (sem esqueleto ou aviso). Se a pessoa está respondendo e o raiz some, o envio dá `400` e a faixa vira erro com `alerta`: “Esse comentário não existe mais.”, e o ✕ limpa.
- **Envio otimista, apagar, vazio, erro:** iguais a `feed.md`; a resposta enviando fica a 55% com “Enviando…” sob o raiz.

| Tela | O que mostra |
|---|---|
| `comentarios-respostas` | Raiz com 2 respostas recuadas, botão Responder e linha-guia |
| `comentarios-respondendo` | Teclado aberto, faixa “Respondendo a Marcos ✕” e campo com `@Marcos ` |
| `comentarios-respostas-muitas` | Raiz com 5 respostas: 2 visíveis e “Ver mais 3 respostas” |
| `comentarios-resposta-envio` | Resposta enviando (55%) e uma que falhou (“Não enviou. Toque para tentar de novo.”) |
| `comentarios-resposta-erro-raiz` | Faixa de erro “Esse comentário não existe mais.” |
| `desktop-comentarios-respostas` | Janela de 390 × 660 com respostas e faixa |

## Acessibilidade

- Alvos de 44: **Responder**, ✕ do aviso, “Ver mais respostas” e o card de nível no `/perfil`.
- Conquista bloqueada tem a regra em texto, e a conquistada traz a data; ícone e borda reforçam, não carregam sozinhos.
- Foco: **Responder** leva ao campo; o ✕ devolve o foco ao botão Responder do comentário. A faixa tem `role="status"`; o erro de raiz, `role="alert"`.
- Resposta é lista aninhada (`ul` dentro do `li` do raiz).

## Pendências para aprovar

1. Acima de 3 respostas, mostrar só as 2 últimas com “Ver mais N respostas” (a regra do plano não fala de limite).
2. `CONQUISTA` só aparece para o próprio autor na Atividade; o resto do grupo vê o post da CBF.
3. Conquista bloqueada mostra a regra, não só um cadeado.
4. Card de nível no `/perfil` leva ao perfil público.
