# Grupo 4: perfil do clube, perfil da pessoa e galeria de prompts (IM-21, Task D2)

Fonte visual: Penpot, página **Perfis (D2-4)** (27 telas, com os nomes das tabelas abaixo). Tokens, tipografia e componentes: `docs/design/fundamentos.md`. Barra inferior e card de post: `docs/design/feed.md`. Nada novo de cor, fonte ou espaço; os componentes novos (linha de configuração, interruptor, abas, grade de capas, etiqueta “Vaga aberta”) estão descritos aqui.

## Rotas

| Rota | Tela |
|---|---|
| `/c/:clubeId` | Perfil do clube |
| `/clubes` | Lista dos 20 clubes (para quem não tem clube, ver abaixo) |
| `/post/:id` | Um post só: seta de voltar + o card de `feed.md` + folha de comentários. Abre pelas capas das grades |
| `/perfil` | Perfil da pessoa |
| `/perfil/senha` | Trocar senha |
| `/galeria` | Galeria de prompts |
| `/galeria/:imagemId` | Detalhe do prompt (tela cheia no celular, janela no desktop) |

O item **Clube** da barra inferior leva a `/c/<meu clube>`; **quem não tem clube vai para `/clubes`** (a barra tem sempre os 5 itens, ver “Alinhar com o front” no fim).

## Componentes novos

- **Abas** (Posts, Histórico): duas colunas iguais, altura 48, rótulo em Inter 16 (ativo peso 600 em `--im-giz` com sublinhado de 3 px × 60 px centralizado, inativo peso 500 em `--im-giz-2`), borda inferior 1 px `--im-linha`. `role="tablist"`.
- **Grade de capas:** 3 colunas, quadrados de 128 px, vão de 3 px (390 = 3 × 128 + 2 × 3), sem raio. Mostra a primeira imagem do post (`miniUrl`). Posts com mais de uma imagem levam o ícone `galeria` (16 px, giz) no canto superior direito. Toque abre `/post/:id` (no desktop, a grade tem colunas de 4 e vão de 3 px).
- **Etiqueta “Vaga aberta”:** pílula de 28 px, sem fundo, borda 1,5 px e texto Inter 600 13 em `--im-amarelo`. (Na lista de clubes a versão de 22 px.)
- **Linha de configuração:** altura 60 (72 com 2 linhas), ícone 24 em giz-2 à esquerda (16 px da borda), título Inter 500 16 em giz, subtítulo `legenda` 13 em giz-2, seta `seta` 20 px à direita quando abre algo, divisor de 1 px `--im-linha` que começa depois do ícone. Texto de estado em `--im-amarelo` quando é aviso (ex.: pedido pendente).
- **Interruptor:** 52 × 32, raio total. Ligado: fundo `--im-vermelho`, botão giz de 24 px à direita. Desligado: fundo `--im-superficie-alta` com borda 1 px `--im-linha`, botão giz-2 à esquerda. `role="switch"` + `aria-checked`.

## Perfil do clube (`/c/:clubeId`)

Topo: seta de voltar (se não for o clube da própria pessoa chegando pela barra, fica oculta quando é a raiz da aba), escudo 88 px em círculo, nome do clube em Barlow Condensed 800 38, e embaixo “Técnico atual” (legenda giz-2), avatar 28 px + nome do técnico em `corpo-forte` + “desde 03/11/2026” (legenda giz-2). Depois as abas **Posts** e **Histórico**.

| Tela (board) | O que mostra |
|---|---|
| `clube-posts` | Aba Posts com a grade de capas (12 por página, rolagem infinita, `GET /api/posts?clube=`) |
| `clube-historico` | Aba Histórico: linha do tempo vertical, do mais novo ao mais velho (`historico` da API). Cada técnico: avatar 40, nome em `corpo-forte`, período “12/10/2026 a 02/11/2026”. O atual leva o ponto vermelho e a etiqueta “Atual” (sem data de fim). Rodapé: “Os posts ficam no clube mesmo depois que o técnico sai.” |
| `clube-vaga-aberta` | Sem técnico: no lugar do técnico entra a etiqueta **Vaga aberta** e “Sem técnico no momento.”; abaixo, o botão **Pedir este clube** (primário, 358 × 48). Os posts antigos continuam |
| `clube-pedido-pendente` | Mesmo clube, mas a pessoa já tem pedido pendente: botão **Pedido enviado** desabilitado e “Aguardando o admin.” (legenda giz-2, centralizado) |
| `clube-sem-posts` | Sem post ainda: “Ainda sem posts” e “Quando o técnico publicar, os posts do clube aparecem aqui.”; no clube da própria pessoa (técnico atual), botão **Novo post**; em clube de outra pessoa, só o texto |
| `clube-carregando` | Esqueleto: círculo do escudo, barras do nome e do técnico, 12 quadrados da grade (pulso, 1,2 s) |
| `clube-erro` | Caixa “Não deu para carregar o clube” com **Tentar de novo** |
| `clubes-lista` | Para quem não tem clube: lista dos 20 clubes por nome. Linha de 68 px: escudo 44, nome em Barlow Condensed 700 22, “Técnico: Lucas” (legenda) **ou** a etiqueta “Vaga aberta”, seta à direita |

Regras:
- **Pedir este clube** só aparece se o clube estiver livre e a pessoa puder pedir (torcedor ou técnico de outro clube). Ele abre o pedido de troca (`POST /api/trocas {tipo:'ASSUMIR', clubeId}`; tela no grupo 5). O próprio clube nunca mostra o botão.
- Ninguém edita nada no perfil do clube (escudo e nome são fixos). O técnico atual posta pelo botão **Postar** da barra; o botão **Novo post** só aparece no estado vazio.
- O histórico mostra datas, não horas. Datas em `dd/mm/aaaa`.
- Quem foi técnico e saiu continua aparecendo no histórico com as datas, e seus posts continuam no clube (`feed.md`: ele não vê o ⋯).

## Perfil da pessoa (`/perfil`)

Topo: título “Perfil” (Barlow Condensed 700 32), avatar de 88 px com o emblema de câmera (28 px) no canto inferior direito, nome em Barlow Condensed 700 32, pílula do clube (24 px) e o e-mail em `legenda` giz-2 (só leitura). Depois as linhas, agrupadas por um rótulo `legenda` giz-2 (Conta, Avisos, Clube):

| Grupo | Linha | O que faz |
|---|---|---|
| Conta | **Nome de exibição** (valor: o nome) | Abre a folha `perfil-nome` |
| Conta | **Senha** (“Trocar a senha”) | Abre `/perfil/senha` |
| Avisos | **Notificações** (“Avisos de post novo e comentário”) com interruptor | `PATCH /api/me {pushEnabled}`; ver estados abaixo |
| Clube | **Palmeiras** (“Técnico desde 03/11/2026”) | Abre `/c/:id` |
| Clube | **Trocar de clube** (“Sair ou assumir outro clube”) | Abre o pedido de troca (grupo 5) |
| fim | **Administração** (só `isAdmin`) | Abre a tela de admin (grupo 5). Linha extra acima de **Sair da conta** |
| fim | **Sair da conta** (giz-2, sem seta) | `POST /api/auth/sair` e volta para `/entrar` |

| Tela (board) | O que mostra |
|---|---|
| `perfil` | Técnico de clube, notificações ligadas |
| `perfil-torcedor` | Sem pílula (“Torcedor, sem clube”); no grupo Clube, a linha “Sem clube” (“Você vê, curte e comenta, mas não posta.”, sem seta) e **Pedir um clube** (abre o pedido de troca, grupo 5) |
| `perfil-troca-pendente` | A linha “Trocar de clube” vira “Pedido pendente” em âmbar (“Assumir o Flamengo. Aguardando o admin.”), sem seta. **Não existe cancelar pedido** (a API não tem). Pedido recusado: “Último pedido recusado em 05/11.” em giz-2 e a linha volta a abrir. Pedido aprovado vira o novo clube (e chega por push) |
| `perfil-foto-enviando` | Tocar no avatar abre direto o seletor de imagem (um toque). A foto é reduzida no celular (JPEG, lado maior 480 px) e enviada (`PUT /api/me/foto`); enquanto isso o avatar fica com véu escuro e spinner e o emblema de câmera some |
| `perfil-foto-erro` | Aviso “Não deu para ler essa imagem. Escolha outra foto.” (imagem ilegível ou `IMAGEM_INVALIDA`) no topo; o avatar continua o antigo |
| `perfil-nome` | Folha de baixo (360 px): “Nome de exibição”, campo em foco com a ajuda “Até 60 letras.”, **Salvar nome** e **Cancelar**. Erro de campo: “Digite um nome de até 60 letras.” |
| `perfil-senha` | Tela com seta de voltar: “Trocar senha” (“Ao salvar, você sai dos outros aparelhos.”), campos **Senha atual** e **Nova senha** (olho para mostrar, ajuda “Pelo menos 8 caracteres.”) e **Salvar senha** fixo embaixo |
| `perfil-senha-erro` | `SENHA_ATUAL_INVALIDA`: “Senha atual incorreta.” no primeiro campo. `MUITAS_TENTATIVAS`: aviso “Muitas tentativas. Espere alguns minutos e tente de novo.” |
| `perfil-push-bloqueado` | Interruptor desligado e a razão em âmbar na própria linha: “No iPhone, o aviso só funciona com o app instalado na tela inicial.” (toque abre “Ver como instalar”, grupo 5). Se a permissão do navegador foi negada: “Você bloqueou os avisos neste aparelho. Libere nas configurações do navegador.” Nunca fica um interruptor travado sem explicação |

Regras:
- Salvar nome e senha mostram “Nome salvo.” / “Senha trocada. Você saiu dos outros aparelhos.” no aviso rápido (barra `--im-superficie-alta`, ícone `ok` gramado, 3 s, `role="status"`).
- Desligar notificações chama `PATCH /api/me {pushEnabled:false}` na hora (otimista; se falhar, volta o interruptor e mostra “Não deu para salvar. Tente de novo.”). Ligar pede a permissão do navegador na hora, só depois do toque.
- O e-mail não é editável na v1 (a API não aceita).

## Galeria de prompts (`/galeria`)

Título “Galeria” (Barlow Condensed 700 32), legenda “Imagens com o prompt que as gerou.” e abaixo o **chip de filtro** (pílula de 40 px, `--im-superficie-alta`, ícone `filtro` + “Todos os clubes” + seta). Em seguida a grade de capas (as mesmas medidas da grade do clube, 3 colunas), só imagens que têm prompt, da mais nova à mais velha (`GET /api/galeria?antes=&clube=`, 12 por página, rolagem infinita).

| Tela (board) | O que mostra |
|---|---|
| `galeria` | Sem filtro |
| `galeria-filtro` | Folha de baixo (600 px) “Filtrar por clube”: primeiro **Todos os clubes** e depois os 20 clubes por nome, com escudo, nome em Barlow Condensed 700 e marcador de opção única (vermelho com check na escolhida). Escolher já aplica e fecha (um toque) |
| `galeria-filtrada` | Chip com borda giz 1,5 px, escudo e o nome do clube (“Palmeiras”) e um **X** no lugar da seta (limpa o filtro) |
| `galeria-vazia` | Clube sem prompts: “Ainda sem prompts do Fluminense” / “Quando o técnico publicar uma imagem com prompt, ela aparece aqui.” e **Limpar filtro** |
| `galeria-carregando` | Esqueleto de 12 quadrados |
| `galeria-erro` | “Não deu para carregar a galeria” com **Tentar de novo** |

### Detalhe do prompt (`/galeria/:imagemId`)

| Tela (board) | O que mostra |
|---|---|
| `galeria-detalhe` | X para fechar à esquerda e “Imagem 1 de 3” (as imagens com prompt do mesmo post) no centro. Imagem inteira na proporção original (`object-fit: contain`, até 390 de largura). Linha com escudo 40, nome do clube em Barlow Condensed 700 20 e “por Lincoln · há 2 horas” (toque leva ao clube). Cartão `--im-superficie` com o rótulo “Prompt” (Barlow Condensed 600 18) e o texto completo em `corpo` 15 (rola dentro do cartão se for longo). Barra fixa embaixo: **Copiar prompt** (primário, 222 × 48, ícone `copiar`) e **Ver o post** (fantasma, 128 × 48, abre `/post/:id`) |
| `galeria-detalhe-copiado` | O botão vira “Prompt copiado” (fundo `--im-superficie-alta`, ícone `ok` em `--im-gramado`) por 2 s e aparece o aviso rápido “Prompt copiado para a área de transferência” (`role="status"`). Volta sozinho ao estado normal |
| `galeria-detalhe-copia-falhou` | `navigator.clipboard` bloqueado: o texto fica selecionado, o cartão ganha borda giz 2 px e a frase em vermelho-texto ensina “Toque e segure no texto para copiar.” Nada de `alert()` |
| `desktop-galeria-detalhe` | Janela de 1040 × 680 sobre fundo escurecido: imagem à esquerda (620 px), à direita escudo, clube, autor, o cartão do prompt, **Copiar prompt** (364 × 48) e **Ver o post**. Esc e X fecham; ← → trocam de imagem |

Regras:
- Deslizar na horizontal (ou ← →) troca de imagem entre as do mesmo post que têm prompt. Se só uma, não mostra a posição.
- Copiar usa `navigator.clipboard.writeText` (e `execCommand('copy')` de reserva). Um toque, sem confirmação.
- Fechar volta à posição da grade e mantém o filtro.

## Desktop (a partir de 768 px)

Mesma barra lateral de `feed.md`. Perfil do clube, perfil da pessoa e galeria ficam numa coluna centralizada de até 640 px (clube e galeria com grades de 4 colunas e vão de 3 px). Detalhe do prompt é janela (acima). A folha de filtro vira menu suspenso embaixo do chip. As folhas do perfil (nome) viram janela central de 440 px.

## Acessibilidade

- Grades: `role="list"`; cada capa é um link com `aria-label` “Post de Lincoln, Palmeiras, 3 imagens”.
- Abas: `role="tablist"` com setas ← →; interruptor `role="switch"`; marcador de clube na folha de filtro é `role="radio"` num `radiogroup`.
- Aviso de cópia e de “Nome salvo” em `role="status"`; erros em `role="alert"`.
- Alvos de toque de 44 px (o X do chip tem 16 px visíveis dentro de uma área de 44).
- Esqueletos e spinners respeitam `prefers-reduced-motion`.

## Alinhar com o front (Perfil provisório do Ponta, IM-9)

O `front/src/conta/Perfil.tsx` da IM-9 (branch `feat/IM-9-conta`) usa só os componentes dos fundamentos, com formulários empilhados. O que **fica** e o que **muda**:

- **Fica:** a lógica de nome (`PATCH /me {nome}` com validação de 1–60), de foto (`comprimir(arquivo, 480)` e `PUT /me/foto`, com `ErroImagem` e `IMAGEM_INVALIDA`), de senha (`senhaAtual`/`senhaNova`, `SENHA_ATUAL_INVALIDA`) e do `sair`. Também ficam os hooks `useEnvio` e `useFocoNoErro` e o `Aviso`.
- **Muda o layout:** em vez de três blocos de formulário abertos na mesma tela, o perfil vira lista de linhas (esta tela). Nome abre folha, senha abre `/perfil/senha`, foto abre o seletor direto no avatar. Some o botão fixo “Trocar foto” e o “Salvar nome” sempre visível.
- **Entra de novo:** interruptor de notificações (`pushEnabled`), linha do clube e “Trocar de clube” / “Pedir um clube” (estados pendente/recusado), linha de admin e o rótulo de grupo. Textos exatos nas tabelas acima.
- **Senha:** o campo “Repetir” **não** entra no perfil (só no fluxo de nova senha por e-mail); aqui são “Senha atual” e “Nova senha”, como o Ponta já fez.
- **BarraInferior provisória:** hoje (branch `feat/IM-9-conta`) ela só tem `aria-label`, ícones próprios e **esconde Clube para quem não tem clube**. Para igualar `feed.md`: rótulos visíveis de 12 px, Postar como pílula vermelha 48 × 32, inativo em `--im-giz-2`, ícones do board Icones, e **o item Clube sempre presente** (sem clube vai para `/clubes`).
- **Rotas:** Ponta já usa `/c/:clubeId`, `/galeria`, `/perfil`. Acrescentar `/clubes`, `/perfil/senha`, `/post/:id` e `/galeria/:imagemId`.

## Pendências para aprovar

1. Quem não tem clube vê a lista de clubes no item Clube da barra (em vez de o item sumir).
2. Sem “cancelar pedido de troca” (a API não tem); o pedido pendente aparece só como estado.
3. E-mail só leitura no perfil.
4. Avatar abre o seletor direto (sem folha de “tirar/escolher/remover”), e não há “remover foto”, pois a API não tem.
5. Galeria em 3 colunas com filtro por clube em folha de lista.
