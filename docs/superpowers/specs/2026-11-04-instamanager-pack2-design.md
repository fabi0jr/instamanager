# InstaManager: design do pack 2

Data: 2026-11-04 · Decisões do Fabio. As calls do Claude estão marcadas como *(call)*.

## 1. Por quê

A v1 está no ar e a galera já posta. O pack 2 tem dois objetivos: deixar o app mais parecido com o que eles fazem no WhatsApp (reações, menções, zoeira) e trazer a **liga para dentro do app** (tabela, rodadas e o perfil "CBF" zoando os perdedores).

## 2. Restrições (valem para tudo)

- **Há dados reais em produção.** Toda migração é aditiva. Nada é apagado nem renomeado. Dado existente é convertido por migração testada num dump de produção antes do deploy. Antes de cada deploy, rodar backup manual.
- **Anti-objetivos da v1 continuam valendo:** não pode ficar lento, difícil de usar no celular, cheio de bugs nem complexo.
- **Sem IA no app.** Os textos do bot saem de modelos prontos.
- **Dependência nova só com aprovação.** Este pack pede uma: **ffmpeg** no container do back, para o vídeo (ver §4.13).
- **Deploys menores:** o pack sai em 3 ondas, cada uma testada e publicada separadamente (§6).

## 3. Mudança de base: "perfil oficial" CBF

- Novo clube especial `cbf` (nome "CBF", escudo próprio) com `oficial = true` *(call: reaproveita o modelo de clube, sem tabela nova)*. Ele não aparece na lista de clubes, no cadastro, na tabela nem nas trocas.
- Só o admin posta como CBF, escolhendo "Postar como CBF". O bot também posta como CBF.

## 4. Funcionalidades

### 4.1 Compartilhar no WhatsApp
- Botão "Compartilhar" no post. Usa a Web Share API e, onde não houver, copia o link `https://instamanager.fj-dev.tech/p/<id>`.
- A prévia do link é genérica (logo + "InstaManager") e **não mostra conteúdo**, porque o app é fechado *(call)*.

### 4.2 Reações com emoji
- Conjunto fixo: ❤️ 🔥 😂 😮 😢 👏. Cada pessoa tem **uma reação por post** e pode trocar ou tirar.
- A curtida da v1 vira ❤️. A migração converte as curtidas existentes em reação ❤️ sem perder nenhuma.
- O toque duplo continua dando ❤️. Tocar e segurar abre o seletor de emojis.
- O card mostra os 3 emojis mais usados e o total.

### 4.3 Tela de atividade
- Lista do que aconteceu com você: reação ou comentário no post do seu clube, menção, decisão de troca, resultado de votação.
- Fica num sino no topo (celular) ou na lateral (desktop), com um número de não lidas. Abrir a tela marca tudo como lido.
- O push continua como está. A atividade é o histórico do que foi avisado.

### 4.4 @menções
- Em comentários, legendas e posts de texto. Digitar `@` abre a lista de pessoas e a menção guarda o id da pessoa, não o nome (nomes podem se repetir).
- Quem é mencionado recebe push e um item na atividade.

### 4.5 Post fixado
- O admin fixa até **3 posts**, que aparecem no topo do feed com um selo "Fixado". Fixar e desafixar fica no menu ⋯ do admin.

### 4.6 Hashtags
- `#palavra` em legenda, texto e comentário vira link para `/tag/<palavra>`, que lista os posts com a tag. Sem acento na comparação.

### 4.7 Tabela e rodadas
- **Formato:** pontos corridos com os 20 clubes, em turno e returno (38 rodadas) *(call, confirmar com o Fabio)*. Vitória vale 3 pontos e empate 1. Desempate: vitórias, saldo, gols pró, nome.
- **Admin:** cria a rodada N, lança os jogos (mandante × visitante + placar) e **fecha a rodada**. Dá para editar o placar até fechar. Depois de fechada, editar exige reabrir.
- **Tela "Liga"** (novo item na barra; Galeria vai para a lateral ou para o perfil, ver §5): tabela com P, J, V, E, D, GP, GC, SG e os últimos 5 jogos, mais a lista das rodadas com os resultados.
- O perfil do clube mostra a posição e os últimos jogos.

### 4.8 Bot da CBF (zoeira)
- Ao **fechar a rodada**, a CBF posta um texto com o resumo da rodada a partir de **modelos prontos** (≥ 40 frases), com o nome do clube e do técnico, o placar e a posição. Casos cobertos:
  - maior goleada;
  - quem perdeu;
  - novo lanterna;
  - quem caiu na tabela;
  - líder isolado;
  - sequência de derrotas;
  - zona de rebaixamento;
  - fim de jejum.
- As frases são sorteadas sem repetir na mesma rodada. Os técnicos citados recebem push.
- O admin vê uma **prévia** do post antes de publicar e pode sortear de novo ou editar.

### 4.9 Prêmios e votações
- O admin cria uma votação com título, tipo (clube, técnico ou post), opções e prazo. Cada pessoa vota uma vez, em segredo até o fim.
- No fim, a CBF posta o resultado e o vencedor ganha um **selo no perfil do clube** (ex.: "Técnico do mês · Nov/26").

### 4.10 Busca
- Uma tela de busca com abas: Posts (legenda e texto), Prompts, Clubes e Pessoas. Fica no topo do feed e da galeria.
- Para 30 pessoas, a busca no próprio Postgres (`ILIKE`, sem acento) é suficiente *(call)*.

### 4.11 Prompts favoritos
- Estrela no detalhe da galeria. Um filtro "Favoritos" na galeria mostra só os seus.

### 4.12 Bio e capa do clube
- O técnico atual edita a bio (até 300 caracteres) e a capa (imagem 3:1, comprimida no celular, mesmo pipeline das fotos).

### 4.13 Stories e vídeo curto
- **Story:** imagem ou vídeo de até **30 s**. Some em **24 h** *(call, confirmar)*. Fica numa faixa de bolinhas no topo do feed, uma por clube que postou story. Toque para ver, com avanço automático, toque para pular e segurar para pausar.
- **Vídeo no post:** um post pode ter vídeo de até 30 s no lugar das imagens.
- **Formato:** o iPhone grava em HEVC/MOV, que nem todo Android toca. O back converte para **MP4 H.264 720p** com **ffmpeg** (dependência nova, aprovar) e gera uma capa. O arquivo original é descartado. Limite de envio: 60 MB.
- O story expirado é apagado do disco por uma limpeza diária.

### 4.14 Denunciar e ocultar
- Qualquer pessoa denuncia um post ou comentário, com motivo opcional.
- O admin vê as denúncias e pode ocultar, que esconde de todos e é reversível, ou apagar.
- Cada pessoa também pode "ocultar este post para mim".

### 4.15 Posts só de texto
- Post sem imagem, com texto de até **500** caracteres *(call, confirmar)*. Aparece como card de texto grande, estilo Twitter, e aceita menções, hashtags e reações.

## 5. Navegação *(call)*
Barra (celular): **Feed · Liga · + Postar · Atividade · Perfil**. A **Galeria** sai da barra e vai para o topo do feed (ícone) e para o perfil, e o **Clube** fica acessível pelo perfil. No desktop, a lateral mostra todos.

## 6. Ondas de entrega
1. **Onda A (rápida):** compartilhar, reações (com migração das curtidas), fixar, hashtags, posts de texto, favoritos, bio e capa, denunciar e ocultar.
2. **Onda B (liga):** perfil CBF, tabela, rodadas, bot da zoeira, votações, selos e a nova navegação.
3. **Onda C (social e mídia):** atividade, menções, busca, stories e vídeo (ffmpeg).

Cada onda passa por design (Penpot), dev, revisão, QA local e deploy com backup antes.

## 7. Fica a critério do builder
Modelagem exata das tabelas novas e dos endpoints (seguindo `docs/api.md`), texto das frases do bot (o Fabio revisa as 40), formato do índice de busca e detalhes visuais dentro dos fundamentos aprovados.
