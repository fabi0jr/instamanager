# Grupo 5: instalar o app, avisos, pedir troca e admin (IM-22, Task D2)

Fonte visual: Penpot, página **Instalar, troca e admin (D2-5)** (26 telas, com os nomes das tabelas abaixo). Tokens, tipografia e componentes: `docs/design/fundamentos.md`. Barra inferior e card de post: `feed.md`. Perfil, linhas de configuração, interruptor e etiqueta “Vaga aberta”: `perfis.md`. Nada novo de cor, fonte ou espaço.

## Rotas

| Rota | Tela |
|---|---|
| `/instalar` | Como instalar (iOS, Android ou outro) |
| `/avisos` | Pedido de permissão de notificação (e os estados dele) |
| `/trocar` | Pedir troca de clube (sair ou assumir) |
| `/admin` | Início da administração (só `isAdmin`; não-admin cai em `/`) |
| `/admin/pedidos` | Pedidos de troca pendentes |
| `/admin/convite` | Código de convite |
| `/admin/clubes` | Clubes e técnicos (tirar técnico) |

Os avisos push abrem `/p/<id>` (post novo e comentário), `/admin` (pedido de troca) e `/perfil` (decisão), como em `docs/api.md` §5. Portanto o **post único** é `/p/:id`.

## Quando aparece instalar e avisos (primeiro login)

Depois do primeiro login (e do cadastro), uma vez por aparelho:

1. **iPhone/iPad no Safari, app ainda não instalado** → `/instalar` (passo a passo do iOS). Sem instalar, o push do iOS não funciona (iOS 16.4+).
2. **Android com Chrome** → `/instalar` com o botão **Instalar app** (evento `beforeinstallprompt`) e, de reserva, o passo a passo do menu.
3. **App já instalado (aberto como PWA, `display-mode: standalone`)** → vai direto a `/avisos`.
4. **Desktop ou outro navegador** → `/instalar` curto avisando que dá para usar no navegador; vai para `/avisos` em seguida.

“Agora não” em qualquer uma guarda a escolha (`localStorage`, nunca dados de conta) e pula para o feed. A pessoa ainda chega lá depois por **Perfil → Notificações**. Não existe tela que bloqueie o app: instalar e avisos são sempre opcionais.

## Instalar o app (`/instalar`)

Topo: ícone do app 64 px, título “Instale o InstaManager” (Barlow Condensed 700 32), texto “Fica na tela inicial como um app, abre mais rápido e permite receber avisos.”

| Tela (board) | O que mostra |
|---|---|
| `instalar-ios` | “Faça isso no Safari” e 3 passos em cartões `--im-superficie` (raio 12, 358 de largura): **1. Toque em Compartilhar** (ícone `compartilhar` no tamanho de 28, com a dica “o quadrado com a seta, na barra de baixo”); **2. Role e toque em “Adicionar à Tela de Início”** (ilustração: linha de lista com ícone `adicionar` + texto, exatamente como o iOS mostra); **3. Toque em “Adicionar”**, e depois **abra o InstaManager pela tela inicial**. Cada cartão tem o número do passo em Barlow Condensed (aqui a numeração é uma sequência de verdade). Rodapé fixo: **Já instalei** (primário, só fecha a tela e explica “Abra o app pela tela inicial para continuar”) e **Agora não** (fantasma) |
| `instalar-android` | Botão primário grande **Instalar app** (aciona o prompt do Chrome). Embaixo, “Se o botão não aparecer:” e 2 passos: **1. Toque nos três pontos ⋮ do Chrome**; **2. Toque em “Instalar app” (ou “Adicionar à tela inicial”)**. **Agora não** |
| `instalar-outro` | Sem iOS/Android: “Dá para usar pelo navegador mesmo.” e a frase “Para instalar, abra o endereço no Safari (iPhone) ou no Chrome (Android).” Botão **Continuar** |

Regras:
- O texto dos passos usa os nomes exatos que o sistema mostra (“Compartilhar”, “Adicionar à Tela de Início”, “Adicionar”).
- Detecção: iOS por `navigator.userAgent` + `!navigator.standalone`; Android pelo `beforeinstallprompt`. Se o evento não vier, mostrar só os passos.
- A ilustração do iOS é desenhada (ícones do board Icones), sem captura de tela do sistema.

## Permissão de notificação (`/avisos`)

Nunca pedir a permissão ao abrir o app. Primeiro vem esta tela explicando; só o toque em **Ativar avisos** chama `Notification.requestPermission()` (obrigatório no iOS por causa do gesto do usuário).

| Tela (board) | O que mostra |
|---|---|
| `avisos-pedir` | Ícone de sino 32, título “Quer saber quando sai post?”, duas linhas curtas: “Post novo de qualquer clube” e “Comentário nos posts do seu clube” (sem numeração, são itens soltos), mais “Você pode desligar quando quiser, no Perfil.” Botões **Ativar avisos** (primário) e **Agora não** (fantasma) |
| `avisos-ativados` | Ícone `ok` em `--im-gramado`, “Avisos ativados”, “Você recebe um aviso quando alguém posta e quando comentam no seu clube. Para desligar, vá em Perfil → Notificações.” Botão **Ir para o feed** |
| `avisos-negados` | Permissão negada: ícone `alerta` âmbar, “Avisos bloqueados”, “O aparelho está bloqueando as notificações do InstaManager. Para liberar:” e 2 blocos curtos por sistema: **iPhone** (“Ajustes → Notificações → InstaManager → Permitir notificações”) e **Android** (“Toque no cadeado ou ⋮ → Configurações do site → Notificações → Permitir”). Botões **Já liberei, tentar de novo** (relê `Notification.permission`) e **Agora não** |
| `avisos-ios-sem-instalar` | iPhone no Safari sem instalar: ícone `alerta` âmbar, “No iPhone, os avisos só funcionam com o app instalado.”, botão **Ver como instalar** (abre `/instalar`) e **Agora não** |

Regras:
- Ao aceitar: `GET /api/push/chave`, `serviceWorker.pushManager.subscribe`, `POST /api/push/inscricao` e `PATCH /api/me {pushEnabled:true}`. Em falha de rede, mostrar o aviso “Não deu para ativar. Tente de novo.” e manter o botão.
- Sem suporte (iOS < 16.4, navegador sem push): a mesma tela de `avisos-ios-sem-instalar`, com o texto “Este aparelho não recebe avisos do navegador. Você usa o app normalmente.” e só o botão **Continuar**.
- O interruptor em **Perfil → Notificações** (`perfis.md`) fala a mesma língua: desligado + motivo em âmbar quando negado ou sem instalar.

## Pedir troca de clube (`/trocar`)

Abre pelas linhas “Trocar de clube” e “Pedir um clube” do perfil, e pelo botão **Pedir este clube** do clube livre (já abre com o clube escolhido). Regra de produto: **um pedido pendente por pessoa**; o admin aprova ou recusa; enquanto isso a pessoa continua no clube de hoje.

| Tela (board) | O que mostra |
|---|---|
| `troca-assumir` | Técnico com clube. Título “Trocar de clube”, texto “O admin aprova o pedido. Enquanto isso você continua no Palmeiras.” Duas opções em cartão (opção única): **Sair do Palmeiras** (“Você vira torcedor e o clube fica com vaga aberta.”) e **Assumir outro clube** (escolhida). Abaixo, a lista de clubes livres (linha de 60 px: escudo 40, nome em Barlow Condensed 700 22, marcador de opção única). Botão fixo **Pedir troca** (desabilitado enquanto não houver escolha) |
| `troca-pedir-clube` | Torcedor (sem clube): título “Pedir um clube”, mesmo texto sem a opção “Sair”, só a lista de livres. Botão **Pedir clube** |
| `troca-enviada` | Ícone `ok` gramado, “Pedido enviado”, “O admin vai avaliar. Você recebe um aviso com a resposta.” Botão **Voltar ao perfil**. No perfil a linha vira “Pedido pendente” (`perfis.md`) |
| `troca-clube-ocupado` | `CLUBE_OCUPADO`: aviso “O Flamengo acabou de ganhar um técnico. Escolha outro clube.”, a lista recarrega sem esse clube e nada fica escolhido |
| `troca-ja-pendente` | `TROCA_PENDENTE`: antes de abrir a lista, “Você já tem um pedido pendente. Espere a resposta do admin.” e botão **Voltar ao perfil** (não mostra a lista) |
| `troca-sem-livres` | Nenhum clube livre: “Nenhum clube livre agora” e “Quando um clube ficar sem técnico, ele aparece aqui.” O técnico ainda pode escolher **Sair do clube**; o torcedor só volta |

Regras:
- Chamada: `POST /api/trocas {tipo:'ASSUMIR', clubeId}` ou `{tipo:'SAIR'}`. `SEM_CLUBE` em `SAIR` (já saiu): aviso “Você já está sem clube.”
- Carregando a lista: esqueleto de 5 linhas; erro: caixa “Não deu para carregar os clubes” com **Tentar de novo** (como no cadastro, `acesso.md`).
- A decisão do admin chega por push (“Troca aprovada” / “Troca recusada”) e abre `/perfil`.
- Pedir não é desfazer: não existe cancelar pedido (a API não tem).

## Admin (`/admin`, só `isAdmin`)

Entra por **Perfil → Administração**. O admin também pode ser técnico de um clube. Em todas as telas admin, um **rótulo “Admin”** (pílula 22 px, `--im-superficie-alta`, `legenda` 12) fica ao lado do título, para lembrar que as ações valem para todo mundo.

| Tela (board) | O que mostra |
|---|---|
| `admin-inicio` | Título “Administração” e 3 linhas de configuração: **Pedidos de troca** (selo vermelho com a contagem, ex.: 2), **Código de convite** (valor “OSM-2026”), **Clubes e técnicos** (valor “17 de 20 com técnico”) |
| `admin-pedidos` | Lista de pedidos pendentes (`GET /api/admin/trocas?status=PENDENTE`), do mais antigo ao mais novo. Cartão de 358 px: avatar 40, nome em `corpo-forte`, “quer assumir o **Flamengo**”, “hoje é técnico do **Palmeiras**” (ou “hoje é torcedor”), “há 2 horas”; botões **Aprovar** (primário, 44 px) e **Recusar** (fantasma, 44 px) lado a lado |
| `admin-pedidos-vazio` | “Sem pedidos pendentes” e “Quando alguém pedir um clube, aparece aqui e você recebe um aviso.” |
| `admin-pedidos-erro` | Caixa “Não deu para carregar os pedidos” com **Tentar de novo** |
| `admin-aprovar-dialogo` | Diálogo (342 px, raio 16): “Aprovar a troca de Marcos?” / “Marcos sai do Palmeiras e assume o Flamengo. O histórico dos dois clubes é atualizado e os posts antigos ficam onde estão.” **Aprovar** (primário) e **Voltar** (secundário). Recusar usa o mesmo diálogo: “Recusar o pedido de Marcos?” / “Ele continua no clube de hoje e recebe um aviso.” **Recusar** e **Voltar** |
| `admin-aprovar-ocupado` | `409 CLUBE_OCUPADO`: o cartão ganha aviso (borda `--im-vermelho-texto`) “O Flamengo já tem técnico. O pedido continua pendente. Recuse ou espere o clube ficar livre.” e **Aprovar** fica desabilitado nesse cartão; **Recusar** segue ativo |
| `admin-convite` | Cartão grande com o código “OSM-2026” em Barlow Condensed 800 48 (seleção fácil), “Um código só para o grupo. Mande no WhatsApp.” Botões **Copiar código** (primário; vira “Código copiado” com `ok` gramado por 2 s) e **Trocar código** (secundário) |
| `admin-convite-trocar` | Folha: campo “Novo código” (mínimo 4 caracteres, maiúsculas, ajuda “Pelo menos 4 caracteres.”), aviso âmbar “O código antigo para de valer na hora. Quem já tem conta continua entrando.” e **Trocar código**. Erro de campo: “Use pelo menos 4 caracteres.” |
| `admin-clubes` | Os 20 clubes por nome. Linha de 68 px: escudo 44, nome em Barlow Condensed 700 22, “Técnico: Lincoln” (com seta) ou a etiqueta **Vaga aberta** (sem ação). Tocar num clube com técnico abre o diálogo abaixo |
| `admin-remover-tecnico` | Diálogo “Tirar Lincoln do Palmeiras?” / “Ele vira torcedor, o clube fica com vaga aberta e os posts continuam no clube. O histórico mostra a data de saída.” **Tirar técnico** (botão `--im-vermelho`, ação destrutiva) e **Voltar** |
| `admin-post-menu` | No feed, o admin vê o ⋯ em **todos** os posts. Folha “Ação de admin”: **Editar legenda e prompts** e **Apagar post** (vermelho-texto, com a nota “como admin”), **Cancelar**. Apagar usa o mesmo diálogo de `feed.md` |
| `admin-comentario-menu` | O admin vê o ⋯ em todos os comentários. Folha com **Apagar comentário** (vermelho-texto) e Cancelar. Sem confirmação extra, igual ao comentário próprio |
| `desktop-admin-pedidos` | Barra lateral de `feed.md` e coluna de 640 px com os cartões de pedido |

Regras:
- Aprovar, recusar e remover mostram o aviso rápido de sucesso (“Troca aprovada. Marcos agora é técnico do Flamengo.” / “Pedido recusado.” / “Lincoln saiu do Palmeiras.”) e a lista se atualiza sem recarregar.
- `TROCA_JA_DECIDIDA` (outro admin ou push duplicado): aviso “Esse pedido já foi decidido.” e o cartão some.
- Apagar post ou comentário como admin segue as rotas normais (`DELETE /api/posts/:id`, `DELETE /api/comentarios/:id`), sem tela separada de moderação.
- Código de convite: `GET/PUT /api/admin/convite`. Remover técnico: `POST /api/admin/clubes/:id/remover-tecnico`.
- Não-admin que abre `/admin` por link: volta ao feed sem aviso (a rota nem aparece no perfil).

## Desktop (a partir de 768 px)

Instalar e avisos são telas de celular: no desktop, `/instalar` mostra só o texto de `instalar-outro` e `/avisos` o pedido de permissão em cartão central de 440 px. Troca e admin: coluna centralizada de 640 px com a barra lateral de `feed.md`; diálogos de 342 px centralizados; folhas viram janela de 440 px.

## Acessibilidade

- Passos de instalar: lista ordenada `<ol>`; os ícones são decorativos (`aria-hidden`) e o texto diz o nome exato do botão do sistema.
- Opções de troca e lista de clubes: `role="radiogroup"` com `role="radio"` por linha; foco visível 2 px giz.
- Diálogos: `role="alertdialog"` com foco no botão **Voltar** (não no destrutivo); Esc fecha.
- Botão destrutivo (Tirar técnico) em `--im-vermelho`, mas sempre com texto explícito; nunca só a cor.
- A contagem de pedidos no selo tem texto para leitor de tela (“2 pedidos pendentes”).
- Avisos de erro em `role="alert"`; sucesso e copiado em `role="status"`; spinners e pulso respeitam `prefers-reduced-motion`.

## Pendências para aprovar

1. Instalar e avisos sempre opcionais (“Agora não”), sem bloquear o app.
2. Tela explicando antes de pedir a permissão (só o toque em **Ativar avisos** chama o sistema).
3. Aprovar pedido de troca com diálogo de confirmação (ação sem volta); recusar também.
4. Rótulo “Admin” nas telas de administração.
