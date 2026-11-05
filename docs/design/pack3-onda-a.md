# Pack 3 · Onda A: design (IM-52, Task A0)

Fonte visual: Penpot, página **Pack 3 · Onda A** (45 telas, nomes nas tabelas). Spec: `docs/superpowers/specs/2026-11-05-instamanager-pack3-design.md` (D, E, C, H); plano: `docs/superpowers/plans/2026-11-05-pack3-onda-a.md`. Tudo dentro dos fundamentos (`fundamentos.md`), da barra e do topo de `onda-c.md`, das abas da Liga de `onda-b.md` e do perfil de `perfis.md`. Celular primeiro (390 px); desktop só na Liga › Copa e no perfil do técnico. **Nada novo de cor, fonte ou espaço.**

Ícones novos (grade 24, traço 1,75, `currentColor`, **`width="24" height="24"` e `aria-hidden`**, o teste `front/src/icones.test.ts` exige) em `docs/design/icones/`: `calendario`, `chave` (colchete da chave da Copa), `bola`, `relogio`, `cadeado`. Reaproveitados: `liga`, `seta`, `voltar`, `ok`, `alerta`, `fechar`, `lixo`, `perfil`, `votacao`, `escudo`, `imagem`, `busca`. O `+` e o `−` dos placares são traços desenhados em CSS (retângulos de 16 × 2), sem ícone.

## Tokens usados (todos já existem)

`--im-carvao`, `--im-superficie`, `--im-superficie-alta`, `--im-linha`, `--im-giz`, `--im-giz-2`, `--im-giz-3`, `--im-vermelho` (só botão primário e interruptor ligado), `--im-vermelho-texto` (erro), `--im-gramado` (ok, pontos ganhos, quem passou), `--im-amarelo` (prazo correndo). Raios `--im-r-btn` (10), `--im-r-midia` (12), `--im-r-folha` (20), `--im-r-pilula`. Escudos dos clubes vêm do cadastro; o círculo verde do Penpot é só placeholder.

## Peças novas

- **Abas da Liga (6):** o mesmo controle de 40 px de `onda-b.md` (pílula `--im-superficie`, borda `--im-linha`, aba ativa `--im-superficie-alta` com borda `--im-giz-3`). Com seis, **rola na horizontal** (sem barra): a aba ativa rola para dentro da vista ao abrir, e a borda direita ganha um degradê de 40 px com `seta` para avisar que tem mais. No desktop (640 px) cabem todas. Ordem: Tabela · Rodadas · Calendário · Copa · Bolão · Votações. `role="tablist"`, ← → troca.
- **Subabas do Bolão:** Palpitar · Ranking, texto Barlow 600 20 (ativa giz com sublinhado de 2 px × 60 em `--im-giz`, inativa giz-2), divisor de 1 px.
- **Chips de escolha** (rodada ou fase): altura 36, raio 18, texto Inter 14; ativo `--im-superficie-alta` com borda `--im-giz-3`, inativo só borda `--im-linha`. Rolam na horizontal.
- **Faixa de prazo** (358 × 52, ou 64 se o texto quebrar; `--im-superficie`, raio 12, borda `--im-linha`): ícone 24 à esquerda e texto Inter 13/500. Três tons: **correndo** (`relogio` + ícone `--im-amarelo`, texto giz) “Palpite até sex 14/11, 19:00. Faltam 2 dias.”; **travado/sem prazo** (`cadeado`, ícone giz-2); **erro** (`alerta`, borda e texto `--im-vermelho-texto`). A contagem vira horas e minutos abaixo de 24 h (“Falta 1 h 20 min.”) e a faixa nunca some enquanto dá para palpitar.
- **Linha de jogo** (64 de altura, divisor de 1 px): escudo 36 + sigla (Barlow 700 18, +0,4 px), centro 134 px com horário (Barlow 700 20) e a legenda, sigla e escudo do visitante à direita.
- **Card do confronto da Copa** (358 × 100, raio 12, `--im-superficie`, borda `--im-linha`): duas linhas de 46 px separadas por divisor; escudo 28 + sigla (Barlow 20) + gols (Barlow 26 à direita) e, entre a sigla e os gols, os pênaltis “(4)” em Barlow 600 18 giz-2. **Quem passou:** sigla Barlow 800, gols 800 e `ok` em `--im-gramado` (20) ao lado. **Eliminado:** escudo a 40%, sigla e gols em giz-3. Sem placar: só os clubes.
- **Placar do palpite** (stepper): três alvos de 44 × 44, `−` (`--im-superficie-alta`, raio 10), o número (caixa `--im-carvao`, raio 10, Barlow 700 28; borda `--im-giz` quando preenchido, `--im-linha` e “–” em giz-3 quando vazio) e `+`. Limites 0 a 99; `−` em 0 fica inerte. Travado: só o número, caixa `--im-superficie`, sem botões.
- **Quem passa nos pênaltis:** só aparece quando o palpite é empate. Rótulo Inter 13/600 e duas opções de 164 × 44 (escudo 24 + sigla Barlow 700 18); escolhida: fundo `--im-superficie-alta`, borda 2 px `--im-giz` e `ok` em gramado. Sem escolha, **Salvar** fica inerte e a faixa abaixo explica: “Empate no palpite: escolha quem passa. Acertar quem passa vale +1.”
- **Ação fixa** (`.acao-fixa`): botão de 48 colado acima da barra (y 724 no celular), fundo `--im-carvao` com divisor de 1 px em cima.
- **Linha de pessoa** (64): avatar 36, nome Inter 15/600, pílula do clube (ou “torcedor” em legenda) embaixo, e o valor à direita. A linha da própria pessoa tem fundo `--im-superficie` e marca de 3 px `--im-giz` na borda esquerda.
- **Campo, folha, aviso rápido, botões:** exatamente os de `fundamentos.md` e `perfis.md` (campo de 48, folha de raio 20 com alça 40 × 4, aviso com `ok` em gramado por 3 s).

## 1. Perfil do técnico (`/u/:id`)

Seta de voltar no topo (alvo 44). Avatar 88, nome Barlow 700 32, pílula do clube (24) e “técnico desde 03/11/2026” (legenda giz-2). Seção **Clubes por onde passou** (Barlow 600 20): linhas de 56 com escudo 32, clube (Barlow 700 18) e período em `legenda` (“03/11/2026 até hoje”, “10/09/2026 a 02/11/2026”), a mais recente primeiro; vem do `historico` da API. Seção **Posts · N**: grade de 3 colunas de quadrados de 128 com vão de 3 (post de texto usa o quadrado de `onda-a.md`); toque abre `/p/:id`. Sem e-mail em lugar nenhum. Nível e conquistas entram na onda B, acima de “Clubes por onde passou”. Menção, busca, atividade e comentário levam para cá.

| Tela | O que mostra |
|---|---|
| `perfil-tecnico` | Técnico com clube, 3 clubes no histórico e 12 posts |
| `perfil-tecnico-torcedor` | Sem pílula (“torcedor, sem clube”), histórico vazio (“Ainda não treinou nenhum clube.”) e caixa “Ainda não tem post” + “Quando Marcos publicar, os posts aparecem aqui.” |
| `perfil-tecnico-carregando` | Esqueleto de avatar, nome, 2 linhas de histórico e 6 quadrados; pulso de 1,2 s, parado em `prefers-reduced-motion` |
| `perfil-tecnico-erro` | Caixa “Não deu para carregar o perfil” e **Tentar de novo** |
| `perfil-tecnico-nao-encontrado` | `404`: caixa “Essa pessoa não está aqui” + “O link pode estar errado ou a conta ter saído do grupo.” e **Voltar ao feed** |
| `desktop-perfil-tecnico` | Lateral de 220 + coluna de 640; posts em 3 colunas de 208 |

## 2. Liga › Calendário

Aba **Calendário** da Liga. Seções por competição (Barlow 600 20): “Brasileirão · rodada 13” e “Copa do Brasil · oitavas”, cada uma com a linha do prazo (`relogio` 16 + Inter 13; âmbar quando falta menos de 24 h, giz-2 antes disso; some se não há prazo). Linhas de jogo: horário no centro e, embaixo, “Palpitar” (Brasileirão) ou “Jogo único” (Copa). Toque numa linha abre o palpite daquele jogo (Liga › Bolão, na rodada ou fase certa). Embaixo, caixa de 56 com `bola`: “Na Copa, empate vai para os pênaltis. Quem passa também vale ponto.” O app só mostra jogos **sem placar** aqui (os já jogados ficam em Rodadas e na Copa).

| Tela | O que mostra |
|---|---|
| `liga-calendario` | 3 jogos do Brasileirão e 2 da Copa |
| `liga-calendario-vazio` | Caixa “Nenhum jogo marcado” + “Quando o admin lançar a próxima rodada ou uma fase da Copa, os jogos aparecem aqui.” |
| `liga-calendario-carregando` | 2 seções de esqueleto |
| `liga-calendario-erro` | “Não deu para carregar o calendário” e **Tentar de novo** |

## 3. Liga › Copa (chave)

Fases em ordem, da mais antiga para a mais nova, cada uma com título (Barlow 600 20) e estado: **Fechada · jogo único** (`ok` giz-2) ou **Palpite até qua 26/11, 21:00** (`relogio` âmbar). Confrontos nos cards descritos acima. Quando o jogo foi para os pênaltis, uma nota Inter 12 giz-2 abaixo do card: “Vasco passou nos pênaltis”. No fim, dica em giz-3: “Semifinal e final aparecem quando o admin criar a fase.” No desktop os cards ficam em 2 colunas de 312.

| Tela | O que mostra |
|---|---|
| `copa-chave` | Oitavas fechadas (vitória simples e pênaltis 4 × 5) e quartas sem placar |
| `copa-sem-fase` | Caixa `chave`: “A Copa ainda não começou” + “Quando o admin criar a primeira fase, a chave aparece aqui.” |
| `copa-carregando` | Título e 2 cards de esqueleto |
| `copa-erro` | “Não deu para carregar a Copa” e **Tentar de novo** |
| `desktop-liga-copa` | Lateral de 220 + coluna de 640 com as 6 abas visíveis e cards em 2 colunas |

## 4. Liga › Bolão › Palpitar

Topo: abas da Liga com **Bolão** ativa, subabas **Palpitar · Ranking**, chips **Rodada 13** e **Copa · quartas** (um chip por rodada ou fase com palpite aberto, a mais próxima primeiro). Depois a faixa de prazo e um card por jogo (358 × 116; na Copa com empate, 196). Cada card tem as duas linhas de clube com o placar ao lado. **Salvar palpites** é fixo (`.acao-fixa`) e manda tudo de uma vez (`PUT /api/bolao/palpites`); só habilita se algo mudou. Salvou: o aviso rápido “Palpites salvos.” e o botão passa a secundário.

Regras que o front respeita:
- Sem prazo (`prazoPalpite` nulo): nada de stepper, números em caixas travadas e a faixa diz “O admin ainda não definiu o prazo. Dá para palpitar quando ele definir.”
- Depois do prazo: tudo travado, faixa com `cadeado` (“Prazo encerrado em sex 14/11, 19:00. Seus palpites estão travados.”) e o botão vira **Ver palpites dos outros**.
- Se o prazo passa com a tela aberta, o `409 PRAZO_ENCERRADO` mostra a faixa de erro “O prazo acabou. Nenhum palpite foi salvo.” e trava os campos; nada é gravado (o back recusa o lote inteiro).
- Empate no palpite da Copa exige escolher quem passa.

| Tela | O que mostra |
|---|---|
| `bolao-palpitar-rodada` | Rodada 13 com 1 jogo preenchido e 2 vazios |
| `bolao-palpitar-copa-empate` | Chip Copa, palpite 1 × 1 e a escolha de quem passa (Vasco) |
| `bolao-palpitar-salvo` | Os 3 palpites preenchidos e o aviso “Palpites salvos.” |
| `bolao-palpitar-travado` | Prazo encerrado, números travados, **Ver palpites dos outros** |
| `bolao-palpitar-sem-prazo` | Faixa de prazo não definido e campos travados |
| `bolao-palpitar-erro-prazo` | `PRAZO_ENCERRADO`: faixa de erro, nada salvo |
| `bolao-palpitar-carregando` | Esqueleto da faixa e de 3 cards |

## 5. Palpites dos outros (`/bolao/jogo/:tipo/:id`)

Abre pelo toque num jogo travado. Seta de voltar e título “Palpites do jogo” (Barlow 700 20). Cartão do jogo (358 × 88): escudos, siglas e, no centro, o resultado em Barlow 800 34 com “resultado final”. Lista **Palpite de cada um** (Barlow 600 20), ordenada por pontos e depois por nome: linha de pessoa com o palpite em Barlow 700 24 e o **chip de pontos** à direita (44 × 30, raio 15; `+3` e `+1` em gramado com borda gramado, `0` em giz-2 com borda `--im-linha`). Na Copa, o chip soma o +1 de quem passa e a linha traz embaixo “passa: Vasco”. Rodapé: “Placar exato vale 3, vencedor ou empate certo vale 1.”

| Tela | O que mostra |
|---|---|
| `bolao-palpites-outros` | Depois do prazo, com resultado e pontos |
| `bolao-palpites-outros-aguardando` | Prazo passou, mas sem placar: palpites sem chip e “Os pontos aparecem quando o admin lançar o placar.” |
| `bolao-palpites-outros-antes` | **Antes do prazo:** só o seu palpite e o aviso com `cadeado`: “Os palpites dos outros aparecem depois do prazo, sex 14/11, 19:00.” |
| `bolao-palpites-outros-erro` | “Não deu para carregar os palpites” e **Tentar de novo** |

## 6. Ranking do bolão

Subaba **Ranking**. Legenda “Brasileirão e Copa somados. Empate: mais exatos, depois o nome.” (giz-2). Linhas de 64: posição (Barlow 800 22; 1 a 3 em giz, as demais em giz-2), avatar, nome e pílula, pontos em Barlow 800 28 e “8 exatos” em `legenda` à direita. Posições iguais em pontos e exatos ficam em ordem de nome. **Minha linha fixa:** se a pessoa não está na parte visível, uma linha de 64 fica presa acima da barra (fundo `--im-superficie`, marca de 3 px à esquerda); se está, só ganha o destaque na própria lista. Sem pontuação nenhuma, a lista não aparece.

| Tela | O que mostra |
|---|---|
| `bolao-ranking` | 9 linhas e a minha, em 12º, fixa embaixo |
| `bolao-ranking-vazio` | Caixa `bola`: “Ninguém pontuou ainda” + “O ranking aparece depois que o admin lançar o primeiro placar com palpites.” |
| `bolao-ranking-carregando` | 6 linhas de esqueleto |
| `bolao-ranking-erro` | “Não deu para carregar o ranking” e **Tentar de novo** |

## 7. Admin (só 👑)

A lista de `/admin` ganha duas linhas, **Calendário e prazos** (`calendario`) e **Copa do Brasil** (`chave`), junto de Rodadas e Votações. Telas com seta de voltar e título em Barlow 700 20. Linha de jogo editável (358 × 116): dois seletores de clube de 220 × 44 (escudo 28 + nome Barlow 700 18, `seta` girada) e, ao lado, a caixa de gols de 44; `lixo` (24, giz-3) à direita. Gols vazios = jogo agendado. No empate de um confronto da Copa o cartão cresce (172) e pede os **pênaltis** (duas caixas, “Quem passa não pode empatar.”).

**Calendário e prazos:** chips das rodadas, campo **Prazo de palpite** (data e hora, `relogio`), jogos da rodada, **Adicionar jogo** (fantasma) e **Salvar rodada** fixo. **Fechar rodada** com jogo sem placar dá `409 PLACAR_PENDENTE`: aviso de borda vermelha “Faltam placares em 2 jogos. Preencha para fechar a rodada.” e os jogos pendentes ficam destacados.

**Copa do Brasil:** lista de fases (nome Barlow 700 22, estado “Fechada · resumo publicado” ou “Aberta · palpite até …”) e o formulário **Nova fase** (nome e ordem, **Criar fase**). Dentro da fase: prazo, confrontos e, fixos, **Salvar** (secundário) e **Fechar fase**. Clube eliminado em fase de ordem maior (`409 CLUBE_ELIMINADO`): borda 2 px `--im-vermelho-texto` no seletor e a frase “Flamengo perdeu nas oitavas e não pode jogar as quartas.” embaixo do card. **Fechar fase** exige todos os placares e abre a folha **Resumo da CBF**: prévia do texto do bot, editável, **Publicar como CBF**, **Cancelar** e a nota “O resumo só pode ser publicado uma vez por fase.” (segundo `publicar` dá `409`). Fase fechada: aviso verde “Fase fechada. Resumo publicado pela CBF.”, placares travados e **Reabrir fase** (fantasma) com a nota “Reabrir deixa mudar placares. Se mudar, os pontos do bolão são recalculados.”

| Tela | O que mostra |
|---|---|
| `admin-lista-pack3` | As quatro linhas do admin de liga |
| `admin-calendario` | Rodada 13: prazo e 2 jogos agendados |
| `admin-calendario-fechar-pendente` | `PLACAR_PENDENTE` |
| `admin-copa-fases` | Fases e formulário de nova fase |
| `admin-copa-fase-confrontos` | Quartas: prazo, empate 1 × 1 com pênaltis 4 × 5, outro confronto sem placar |
| `admin-copa-erro-eliminado` | `CLUBE_ELIMINADO` |
| `admin-copa-fechar-previa` | Folha com a prévia do bot e **Publicar como CBF** |
| `admin-copa-fase-fechada` | Fase fechada e publicada, com **Reabrir fase** |
| `admin-copa-carregando` | Esqueleto da lista de fases |
| `admin-copa-erro` | “Não deu para carregar as fases” e **Tentar de novo** |

## 8. Perfil › Avisos (preferências de push)

No `/perfil`, o grupo **Avisos** (de `perfis.md`) mantém a linha mestre **Receber avisos neste aparelho** (o `pushEnabled` de sempre) e ganha seis interruptores de 44 × 24, uma linha de 68 cada (título Inter 16/600, descrição `legenda` giz-2): **Posts novos**, **Comentários no meu clube**, **Menções**, **CBF**, **Bolão** (“Lembrete 2 h antes do prazo e resultado”) e **Trocas de clube**. Todos nascem ligados. Mexer num interruptor salva na hora (`PATCH /api/me {pushPrefs}`), otimista; se falhar, volta o interruptor e aparece “Não deu para salvar. Tente de novo.” Com o interruptor mestre desligado, os seis ficam a 40% e inertes, e a descrição do mestre diz “Desligado. Ligue para escolher quais avisos chegam.” O estado de aparelho bloqueado continua o de `perfil-push-bloqueado` (`perfis.md`).

| Tela | O que mostra |
|---|---|
| `perfil-avisos` | Tudo ligado |
| `perfil-avisos-alguns-desligados` | Comentários e Bolão desligados, com o aviso “Preferência salva.” |
| `perfil-avisos-geral-desligado` | Mestre desligado, seis interruptores esmaecidos |
| `perfil-avisos-erro-salvar` | Falha ao salvar: “Não deu para salvar. Tente de novo.” |

## Acessibilidade

- Alvos de 44 × 44 em `−`, `+`, opções de quem passa, interruptores e `lixo`. O número do placar é `role="spinbutton"` com `aria-valuemin=0` e `aria-valuemax=99`; o rótulo diz “Gols do Santos, 2”.
- O estado “eliminado”, “passou” e “travado” nunca é só cor ou opacidade: tem `ok`, o texto “passou nos pênaltis” ou `cadeado`.
- Faixa de prazo e erro usam `role="status"`/`role="alert"`; erro de campo usa `alerta` mais frase, como em `fundamentos.md`.
- Abas e subabas: `role="tablist"`, teclado ← →; chips de rodada e fase também.
- Esqueleto parado em `prefers-reduced-motion`.

## Pendências para aprovar

1. Subabas **Palpitar · Ranking** dentro de Bolão (a spec não fixou como dividir).
2. Seis abas rolando na horizontal no celular, com a ativa sempre à vista.
3. Resumo da fase editável antes de publicar (a API só recebe `{texto}`).
4. Chip de pontos com o +1 de quem passa somado, e a nota “passa: Vasco” na linha da Copa.
