# Grupo 1: acesso (IM-18, Task D2)

Telas de entrar, cadastro em 3 passos, esqueci a senha e nova senha. Fonte visual: Penpot, página **Acesso (D2-1)** (22 telas, com os mesmos nomes da tabela abaixo). Tokens, tipografia e componentes: `docs/design/fundamentos.md`. Nada novo de cor, fonte ou espaço neste grupo.

Regras gerais do grupo:
- Celular 390 px, margem lateral 16 px (conteúdo de 358 px). Desktop (≥ 768 px): cartão `--im-superficie` centralizado, raio 12, borda 1 px `--im-linha`, 440 px (entrar) ou 500 px (cadastro), margem interna 40.
- O botão principal fica **fixo no fim da tela** nos passos e formulários (`bottom: 16px + safe-area`), 358 × 48. Com o teclado aberto ele sobe junto (usar `100dvh`).
- Campos: rótulo em cima, mensagem de erro **embaixo do campo** (ícone `alerta` 16 + frase em `--im-vermelho-texto`). Aviso geral da tela (erro de servidor) é um bloco `--im-superficie` com borda 1 px `--im-vermelho-texto`, raio 10, ícone `alerta` 20, texto 14.
- Atributos HTML: e-mail `type="email" autocomplete="email" inputmode="email"`; senha `autocomplete="current-password"` (entrar) ou `"new-password"` (cadastro e nova senha); nome `autocomplete="nickname"`; convite `autocapitalize="characters" autocomplete="off"`. O olho alterna mostrar/ocultar a senha (`aria-label` “Mostrar senha” / “Ocultar senha”, alvo de 44 px).
- Ao enviar: botão vira o gerúndio com spinner, campos ficam desabilitados (55% de opacidade), nada de clicar de novo. Erro de campo foca o primeiro campo com erro.
- Foto de perfil **não** entra no cadastro (a API só aceita a foto depois, em `PUT /api/me/foto`). Ela fica no perfil da pessoa (grupo 4).

## Telas

| Tela (board no Penpot) | Rota | O que tem |
|---|---|---|
| `entrar` | `/entrar` | Marca (ícone 72 + nome 44), campos e-mail e senha, link “Esqueci a senha” à direita, botão **Entrar**, e embaixo “Ainda não tem conta?” + botão fantasma **Criar conta com convite** |
| `entrar-erro` | | Aviso “E-mail ou senha incorretos. Tente de novo.” (`CREDENCIAIS_INVALIDAS`) e os dois campos com borda de erro. O erro **não** diz qual dos dois está errado |
| `entrar-carregando` | | Campos desabilitados, botão “Entrando…” com spinner |
| `esqueci` | `/esqueci-senha` | Voltar, título, texto (“Se ele existir, enviamos um link… vale 1 hora”), campo e-mail, botão **Enviar link** |
| `esqueci-enviado` | | Sempre a mesma resposta (a API devolve `204` mesmo se o e-mail não existe): “Confira seu e-mail”, link “Enviar de novo” (liberar depois de 60 s), botão **Voltar para entrar** |
| `cadastro-1-convite` | `/cadastro` | Passo 1 de 3: campo “Código de convite”, botão **Continuar**, link “Já tenho conta. Entrar” |
| `cadastro-1-convite-erro` | | “Esse código não vale. Confira com quem te convidou.” (`CONVITE_INVALIDO`) |
| `cadastro-2-dados` | | Passo 2 de 3: nome de exibição (ajuda “Até 60 letras”), e-mail, senha (ajuda “Pelo menos 8 caracteres”) |
| `cadastro-2-dados-erro` | | “Esse e-mail já tem conta. Entre ou recupere a senha.” (`EMAIL_EM_USO`) + link “Entrar com esse e-mail” |
| `cadastro-3-clube` | | Passo 3 de 3: lista de clubes **livres** (linha de 60 px: escudo 40, nome em Barlow Condensed 700 22, marcador à direita) + linha “Sou só torcedor” (80 px). Um escolhido por vez; escolhido = borda 2 px `--im-giz` e marcador vermelho com check. Botão **Criar conta** (desabilitado enquanto nada estiver escolhido) |
| `cadastro-3-clube-carregando` | | Esqueleto das linhas (pulso), botão desabilitado |
| `cadastro-3-clube-ocupado` | | Aviso “O Palmeiras acabou de ganhar um técnico. Escolha outro clube.” (`CLUBE_OCUPADO`); a lista recarrega sem esse clube e nada fica selecionado |
| `cadastro-3-clube-vazio` | | Todos os 20 clubes ocupados: caixa “Todos os clubes já têm técnico” e “Sou só torcedor” já escolhido |
| `cadastro-3-clube-erro` | | Falha ao carregar `GET /api/clubes?livres=1`: caixa de erro com **Tentar de novo**; “Sou só torcedor” continua disponível |
| `cadastro-3-enviando` | | Botão “Criando conta…” com spinner, lista inerte |
| `nova-senha` | `/nova-senha?token=…` | Nova senha + repetir (ajuda “Pelo menos 8 caracteres”), botão **Salvar senha** |
| `nova-senha-erro` | | “As senhas não são iguais.” (validação no cliente, abaixo do 2º campo) |
| `nova-senha-salvando` | | Campos desabilitados, botão “Salvando…” |
| `nova-senha-link-invalido` | | Sem formulário: “Esse link não vale mais” (`TOKEN_INVALIDO`: venceu, já foi usado ou está incorreto), botão **Pedir novo link** → `/esqueci-senha` |
| `nova-senha-pronto` | | “Senha trocada. Você saiu dos outros aparelhos.” e botão **Entrar** → `/entrar` |
| `desktop-entrar`, `desktop-cadastro-clube` | | Versão ≥ 768 px: cartão centralizado; no passo 3 os clubes ficam em 2 colunas de 206 px |

## Fluxo do cadastro (importante para o front)

Os 3 passos são só telas: o código de convite **não é validado** no passo 1 (não há rota para isso). Tudo vai junto no `POST /api/auth/cadastro` do passo 3, e os erros voltam assim:
- `CONVITE_INVALIDO` → volta ao passo 1, com o erro no campo.
- `EMAIL_EM_USO` → volta ao passo 2, com o erro no campo de e-mail.
- `CLUBE_OCUPADO` → fica no passo 3, mostra o aviso, recarrega a lista e limpa a escolha.
- `MUITAS_TENTATIVAS` (429) em qualquer tela → aviso geral “Muitas tentativas. Espere alguns minutos e tente de novo.” e botão desabilitado por 60 s.
- Sem rede ou `5xx` → aviso geral “Não deu para completar. Confira a conexão e tente de novo.” e os dados digitados ficam.

Os passos guardam o que foi digitado só em memória (**a senha nunca vai para `localStorage`**). Voltar com a seta mantém os campos. Sucesso (`201`) já abre a sessão e leva ao feed (e, no primeiro login, à tela de instalar o app, grupo 5).

## Copy

Títulos em Barlow Condensed 700 32/34. Texto de apoio `corpo` em `--im-giz-2`. Botões: **Entrar**, **Criar conta com convite**, **Continuar**, **Criar conta**, **Enviar link**, **Salvar senha**, **Pedir novo link**, **Voltar para entrar**, **Tentar de novo**. O mesmo verbo vale no botão e no carregando (“Entrar” → “Entrando…”, “Salvar senha” → “Salvando…”, “Criar conta” → “Criando conta…”).

## Estados e acessibilidade

- Passo: `<nav aria-label="Passo 2 de 3">`; as barras são decorativas (`aria-hidden`), o texto “Passo 2 de 3” é o que o leitor de tela lê.
- Lista de clubes: `role="radiogroup"` com um `role="radio"` por linha (inclui “Sou só torcedor”); setas movem a escolha; a linha toda é alvo de toque (60 px).
- Avisos de erro em `role="alert"`; erro de campo ligado por `aria-describedby`.
- Foco de teclado: contorno 2 px `--im-giz` deslocado 2 px (já nos fundamentos).
- Esqueleto e spinner respeitam `prefers-reduced-motion`.
- Os clubes livres vêm da lista fixa dos 20; os escudos nas telas são placeholder verde (os reais vêm da IM-4).

## Pendências para o Fabio aprovar

1. Os 3 passos sem validar o convite antes (só no fim), por limite da API. Para validar já no passo 1 seria preciso uma rota nova (mudança no spec).
2. “Sou só torcedor” como linha no fim da lista de clubes.
3. Foto de perfil fora do cadastro (fica para o perfil).
