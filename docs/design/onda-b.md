# Pack 2 · Onda B: design (IM-38, Task B0)

Fonte visual: Penpot, página **Pack 2 · Onda B** (34 telas, com os nomes das tabelas abaixo). Spec: `docs/superpowers/specs/2026-11-04-instamanager-pack2-design.md` (§3, 4.7, 4.8, 4.9, 5); plano: `docs/superpowers/plans/2026-11-04-pack2-onda-b.md`. Tudo dentro dos fundamentos (`fundamentos.md`), do card e da barra de `feed.md`, do perfil do clube de `perfis.md`, do ⋯ e das folhas de `onda-a.md` e do admin de `instalar-troca-admin.md`. Celular primeiro (390 px); desktop só onde muda. Nada novo de cor, fonte ou espaço.

Ícones novos (grade 24, traço 1,75, `currentColor`), em `docs/design/icones/`: `liga` (troféu), `selo` (medalha), `votacao` (urna), `sortear` (setas em círculo). Já existem e são reaproveitados: `seta`, `ok`, `alerta`, `editar`, `lixo`, `fechar`, `texto`. O **escudo da CBF** está em `front/public/escudos/cbf.svg` (seção 3).

## 1. Barra nova

**Feed · Liga · + Postar · Galeria · Perfil.** O Clube sai da barra e passa para o topo do Perfil; a Atividade só entra na onda C. Item ativo: ícone e rótulo em `--im-giz`; inativos em `--im-giz-2`. Postar continua a pílula `--im-vermelho` de 48 × 32. Cinco alvos de 78 × 64. Torcedor sem clube vê, em Postar, a folha de `feed.md`.

Desktop: a barra lateral de 220 px ganha **Liga** (ícone `liga`) entre Feed e Postar; ordem Feed, Liga, Postar, Galeria, Clube, Perfil. O Clube continua na lateral porque ali sobra espaço.

| Tela | O que mostra |
|---|---|
| `barra-nova` | A barra com Liga ativa e as regras acima |
| `perfil-meu-clube` | Perfil com o cartão **Meu clube** no topo (escudo 44, nome, “1º na Liga · técnico desde …”, seta para `/c/:id`) e os atalhos Galeria de prompts, Votações (“1 aberta”) e Liga. Torcedor sem clube: o cartão vira **Pedir um clube** (`perfis.md`) |

## 2. Liga (`/liga`)

Título “Liga” (Barlow Condensed 800 28), legenda “Rodada 12 de 38 · só rodadas fechadas contam” e um controle de três abas: **Tabela · Rodadas · Votações** (pílula de 40 px `--im-superficie`, aba ativa `--im-superficie-alta` com borda). A rodada atual é a última fechada.

**Tabela.** Linhas de 27,5 px (20 clubes cabem sem rolar a página, só o fim fica sob a barra). Colunas do celular: `#` (Barlow 600 16, giz-2), escudo 20 + nome (Inter 14), **P** (Barlow 700 17, giz, é a coluna que manda), J, V, SG (Inter 13, giz-2) e os **últimos 5** (5 bolinhas de 7 px, vão 3: V `--im-gramado`, E `--im-giz-3`, D `--im-vermelho-texto`; do mais velho ao mais novo da esquerda para a direita; o `aria-label` da linha diz “últimos 5: vitória, derrota, …”, nunca só a cor). Zonas: barra de 3 px na borda esquerda, **topo** (4 primeiros, `--im-gramado`) e **rebaixamento** (4 últimos, `--im-vermelho`), com a legenda acima da tabela. A linha do clube da pessoa tem fundo `--im-superficie-alta`. Toque na linha abre `/c/:id`.

**Tabela completa** (`GET /api/liga/tabela` traz tudo): P, J, V, E, D, GP, GC, SG. No celular o botão “colunas completas” não existe; a tabela rola na horizontal com o clube fixo à esquerda (as colunas V, E, D, GP, GC aparecem ao deslizar). No desktop mostra tudo.

**Rodadas.** Faixa de chips de rodada (48 × 36, Barlow 700 20; a escolhida em `--im-giz` com número `--im-carvao`), rolável. Abaixo, “Rodada 11” e a etiqueta **Fechada** (ícone `ok` gramado). Cada jogo é uma linha de 56 px: mandante (nome à direita) · escudo 22 · placar em Barlow 700 24 (“3 × 0”) · escudo 22 · visitante. Quem ganhou fica em 700, quem perdeu em giz-2; empate os dois em 500. Rodada **aberta** (etiqueta âmbar “Em andamento”): aviso “Placar parcial. Só vale na tabela depois que o admin fechar a rodada.”, placares em giz-2 e rodada sem jogos mostra “Faltam jogos a lançar”.

| Tela | O que mostra |
|---|---|
| `liga-tabela` | Aba Tabela, modo celular, clube da pessoa (Santos) destacado |
| `liga-tabela-completa` | Todas as colunas, com a dica de rolar na horizontal |
| `liga-vazia` | Nenhuma rodada fechada: cartão “Nenhuma rodada fechada ainda” e os clubes em ordem alfabética com 0 ponto |
| `liga-carregando` | Esqueleto de 16 linhas (pulso de 1,2 s, parado em `prefers-reduced-motion`) |
| `liga-erro` | Caixa “Não deu para carregar a tabela” e **Tentar de novo** |
| `liga-rodadas` | Aba Rodadas, rodada 11 fechada |
| `liga-rodada-aberta` | Rodada 12 em andamento, com o aviso de parcial |
| `liga-votacoes` | Aba Votações (seção 5) |
| `desktop-liga` | Lateral de 220 + coluna de 640 com a tabela completa e os últimos 5 |

## 3. Perfil da CBF e escudo

A CBF é um clube com `oficial = true` (spec §3). O perfil `/c/cbf` é o perfil do clube (`perfis.md`) com estas diferenças:
- **Escudo próprio** (`cbf.svg`): escudo carvão com borda giz de 8, faixa `--im-vermelho` no alto e “CBF” em giz, desenhado do zero (não copia o logo oficial da CBF). Mostrado sem círculo, 90 × 120 sobre a capa. Em listas e no card, 30 × 40. Abaixo de 28 px de altura as letras viram mancha: nesses tamanhos usar `generico.svg`.
- Faixa `--im-vermelho` de 4 px na base da capa.
- Nome “CBF” (Barlow 800 34), etiqueta **Oficial** (ícone `ok` em `--im-gramado`, pílula `--im-superficie-alta`) e a frase “Perfil oficial da liga”; bio padrão do back.
- **Sem** técnico, sem “Vaga aberta”, sem “Pedir este clube”, sem posição na Liga, sem selos e sem aba Histórico; só **Posts**. A grade usa os quadrados de post de texto (`onda-a.md`).

**Card da CBF no feed** (`card-cbf`): igual ao card de texto, com o escudo da CBF no lugar do círculo, a etiqueta **Oficial** ao lado do nome e “bot da rodada · há 5 minutos”. O corpo é um bloco `--im-superficie` com barra `--im-vermelho` de 5 px à esquerda, rótulo **COMUNICADO · RODADA 11** (Barlow 700 15, `--im-vermelho-texto`) e o texto em Barlow 700 26/32 (cabem ~190 caracteres; mais que isso desce para 24/30 e 20/28, como em `onda-a.md`). Nome e escudo levam para `/c/cbf`. A linha “15 reações” abre **Quem reagiu** (seção 6).

| Tela | O que mostra |
|---|---|
| `perfil-cbf` | Perfil da CBF |
| `card-cbf` | Post do bot no feed |

## 4. Admin: rodadas (`/admin/rodadas`)

Nova linha **Rodadas** (ícone `liga`) e **Votações** (ícone `votacao`) na lista do admin (`instalar-troca-admin.md`); só 👑.

**Lista** (`admin-rodadas-lista`): linhas de 58 px “Rodada 12” (Barlow 700 22), contagem de jogos e etiqueta de estado: **Sem jogos** (giz-3), **Aberta** (âmbar), **Fechada** (gramado). A aberta leva borda giz 2 px. As 38 rodadas existem desde o início.

**Jogos** (`admin-rodada-jogos`, `PUT /api/admin/rodadas/:n/jogos`): um cartão por jogo com dois seletores de clube (escudo + nome + seta, 214 × 44) e, ao lado, o placar de cada um (campo numérico 60 × 44, Barlow 700 24, teclado numérico, 0 a 99) e a lixeira. Clube já usado na rodada aparece desabilitado e com “já joga nesta rodada” no seletor. **Adicionar jogo** abre um cartão novo (até 10). Barra fixa: **Salvar jogos** (secundário) e **Fechar rodada** (primário). Salvar substitui todos os jogos (a API é assim). Salvando: botão com spinner e campos inertes.

**Erro** (`admin-rodada-erro`, 400): caixa com borda `--im-vermelho-texto` “Santos aparece 2 vezes. Cada clube joga uma vez por rodada. Nada foi gravado: corrija e salve de novo.”, os dois cartões com os seletores em borda vermelha. Outros 400: placar fora de 0–99 (o campo já impede, a mensagem é “Placar de 0 a 99”) e jogo repetido (“Esse jogo já está na rodada”). Rodada fechada (409) mostra “Essa rodada foi fechada. Reabra para editar.”

**Fechar → prévia do bot** (`admin-rodada-previa`): **Fechar rodada** não fecha direto, abre esta tela cheia (X no canto) “Prévia do post da CBF · Sai ao fechar a rodada 12”: o post como vai sair (cabeçalho da CBF e o bloco de comunicado), os botões **Sortear de novo** (ícone `sortear`) e **Editar texto** (ícone `editar`), a linha “Frase 7 de 46 · não repete nesta rodada”, as pílulas dos **técnicos que recebem aviso** (os citados no texto) e a barra fixa **Fechar e publicar** (primário) com **Fechar sem postar** (texto, giz-2) embaixo. Rodada sem jogo nenhum não fecha (“Lance ao menos um jogo”).
- **Editando** (`admin-rodada-previa-editando`): o bloco vira um campo com foco (borda giz 2), contador “138/500”, ajuda “O texto editado vai como está. Menções com @ avisam a pessoa.” e **Voltar à frase sorteada** (secundário). Sortear de novo troca a frase e perde a edição, então pede confirmação só se o texto foi editado (“Descartar o texto editado?”).

**Fechada** (`admin-rodada-fechada`): aviso gramado “Rodada fechada. O post da CBF já saiu e a tabela já conta esses jogos.”, jogos só leitura e **Reabrir para editar** (secundário). `admin-reabrir-dialogo` pede confirmação: “Reabrir a rodada 11? A tabela é recalculada sem esses jogos até você fechar de novo. O post da CBF que já saiu não muda.” com **Reabrir rodada** (primário) e **Cancelar**.

| Tela | O que mostra |
|---|---|
| `admin-rodadas-lista`, `admin-rodada-jogos`, `admin-rodada-erro` | Lista, edição e erro de validação |
| `admin-rodada-previa`, `admin-rodada-previa-editando` | Prévia do bot e edição do texto |
| `admin-rodada-fechada`, `admin-reabrir-dialogo` | Rodada fechada e confirmação de reabrir |

## 5. Votações

**Para todos** (`/liga`, aba **Votações**, e um aviso no topo do feed “Votação aberta: Técnico do mês · Votar”): cartões das abertas (ícone `votacao`, título em Barlow 700 22, “6 técnicos concorrendo · voto secreto”, etiqueta âmbar “Termina em 2 dias” e **Votar**; se a pessoa já votou, a etiqueta vira “Você votou · resultado ao fechar” com `ok` e o botão some) e, abaixo, as **encerradas** (“Venceu: Palmeiras”, seta para o resultado).

**Votar** (`/votacoes/:id`, tela `votar`): lista de opções em cartões de 60 px (escudo 28, nome em Barlow 700 20, “técnico do Palmeiras”, marcador redondo). A escolhida fica `--im-superficie-alta` com borda giz 2 px e check. Barra fixa **Confirmar voto** e, abaixo, “Depois de enviado, o voto não muda.” Tipo **Clube**: escudo e nome; **Técnico**: nome e clube; **Post**: miniatura de 56 px e o início da legenda, com toque para abrir o post numa folha.

| Tela | O que mostra |
|---|---|
| `liga-votacoes` | Abertas (uma por votar, outra já votada) e encerradas |
| `votar` | Escolha feita, antes de confirmar |
| `votar-aguardando` | Depois do voto: caixa gramado “Seu voto está guardado. O resultado aparece quando a votação fechar.”, opções sem mudança e etiqueta **Seu voto** na escolhida. Ninguém vê parcial |
| `votar-prazo-vencido` | Aviso âmbar “O prazo acabou. O admin ainda vai fechar a votação e divulgar o resultado.”, opções apagadas e o botão desabilitado “Votação encerrada” (`PRAZO`) |
| `votar-resultado` | “29 votos · resultado final”, barras do mais ao menos votado com a porcentagem em Barlow 700 26, o vencedor com borda giz e fundo avermelhado escuro, a opção da pessoa marcada “seu voto” e a caixa do **selo** (“Selo para o Flamengo · Técnico do mês · Nov/26, agora no perfil do clube”) |

Erros: votar de novo (`JA_VOTOU`) mostra “Você já votou nesta votação.” e vai para `votar-aguardando`; falha de rede mantém a escolha com “Não deu para votar. Tente de novo.” (`role="alert"`).

**Admin** (`/admin/votacoes`): lista com **Nova votação**, etiquetas Aberta/Encerrada, “19 de 28 já votaram · termina quinta, 21h” (só a contagem, nunca em quem) e, nas encerradas, o vencedor. `admin-votacao-criar`: **Título**, **O que vai ser votado** (Clube · Técnico · Post), **Concorrentes** (chips removíveis preenchidos com todos os clubes/técnicos, **Adicionar mais**; em Post, o admin cola o link `/p/<id>` de cada post) e **Prazo** (data e hora, obrigatório, no futuro). Botão fixo **Criar votação**. `admin-votacao-encerrar` (diálogo): “A CBF posta o resultado e o vencedor ganha o selo “Técnico do mês · Nov/26” no perfil do clube. Não dá para desfazer.” com **Encerrar agora** e **Cancelar**; avisa quantos votaram.

| Tela | O que mostra |
|---|---|
| `admin-votacoes` | Lista do admin |
| `admin-votacao-criar` | Criar (tipo Técnico, 6 concorrentes, prazo) |
| `admin-votacao-encerrar` | Confirmar encerrar |

## 6. Selos e posição no perfil do clube

`clube-liga-selos` (perfil do clube, `perfis.md` + `onda-a.md`): abaixo do cabeçalho entra o **cartão da Liga** (358 × 64): posição em Barlow 800 32 (“10º”), “na Liga”, “17 pontos · 12 jogos” em giz-3, os últimos 5 e a seta (abre `/liga`). Sem rodada fechada, o cartão some. Depois, **SELOS** (legenda giz-2) com cartões de 174 × 64, borda `--im-amarelo`, ícone `selo` em âmbar, título (“Técnico do mês”) e mês (“Nov/26”). Sem selo, a seção some. Mais de 2 selos: segunda linha; passou de 6, “Ver todos” abre uma folha. Depois seguem as abas Posts e Histórico.

## 7. Folha “Quem reagiu”

Abre ao tocar em “N reações” (card e `/p/:id`). Folha de baixo (`onda-a.md`, raio 20, alça de 40 × 4): título “Reações” com o total em giz-2 e X. **Abas por emoji** com contagem (“Todas” 15, ❤️ 6, 🔥 5, 😂 3, 😮 1, só os que têm reação), sublinhado giz 2 px na ativa; rolam na horizontal. Linhas de 56 px: avatar 40, nome (Inter 15/600), escudo 14 + clube (giz-2) e, na aba “Todas”, o emoji de 22 px à direita. Toque na linha abre o perfil da pessoa. Só pessoas, nunca contagem de quem já saiu. Respeita a visibilidade do post.

| Tela | O que mostra |
|---|---|
| `quem-reagiu` | Aba Todas com 8 pessoas |
| `quem-reagiu-fogo` | Aba 🔥 (só quem reagiu com 🔥) |
| `quem-reagiu-erro` | “Não deu para carregar a lista” com **Tentar de novo**; carregando = 6 linhas de esqueleto; post oculto/apagado (404) fecha a folha com o aviso “Este post não está mais disponível” |

Acessibilidade: `role="dialog"` com foco no título; abas `role="tablist"`; cada linha “Lincoln, Palmeiras, reagiu com fogo”.

## 8. Postar como CBF

No passo 2 do `/postar` (`postar.md`), **só para o admin**, entra uma linha logo abaixo de “Vai sair como Palmeiras, por Lincoln.”: cartão de 64 px com o escudo da CBF, **Postar como CBF**, ajuda “Só o admin. O post sai no perfil oficial.” e um interruptor (44 × 24, vermelho quando ligado). Ligado: o cartão ganha borda giz 2 px, a frase vira **“Vai sair como CBF, perfil oficial.”** (giz, 600) e o botão **Publicar como CBF**. Desligado por padrão, a cada post. Vale também para o post de texto (`onda-a.md`). Quem não é admin não vê a linha.

| Tela | O que mostra |
|---|---|
| `postar-como-cbf-off` | Interruptor desligado |
| `postar-como-cbf-on` | Ligado, com o botão **Publicar como CBF** |
| `postar-como-cbf-erro` | `403` (perdeu o acesso de admin): “Só o admin pode postar como CBF. Seu acesso mudou. Publique pelo seu clube.” e o botão vira **Publicar pelo meu clube** |

O progresso, a falha e o “Post publicado” são os de `postar.md`.

## Acessibilidade

- Bolinhas dos últimos 5 e zonas da tabela nunca só por cor: `aria-label` e legenda em texto.
- Tabela como `<table>` com `<th scope>`; P é a coluna ordenada (`aria-sort`).
- Abas da Liga e de Quem reagiu: `role="tablist"`; teclado ← → muda a aba.
- Votação: opções `role="radiogroup"`; resultado em lista com “41%, 12 votos”.
- Diálogos (reabrir, encerrar, descartar texto): foco no botão seguro (**Cancelar**), Esc fecha.
- Alvos de 44 px; spinners e pulso estáticos em `prefers-reduced-motion`.

## Pendências para aprovar

1. Barra: Feed · Liga · Postar · Galeria · Perfil, com o Clube no topo do Perfil.
2. Tabela no celular com P, J, V, SG e os últimos 5 (o resto rola na horizontal).
3. Fechar rodada passa pela prévia do bot, com “Fechar sem postar”.
4. Votações aparecem na aba da Liga e como aviso no feed; voto não muda depois de enviado.
5. Escudo da CBF desenhado do zero (`front/public/escudos/cbf.svg`), sem copiar o logo oficial; abaixo de 28 px de altura usar o genérico.
