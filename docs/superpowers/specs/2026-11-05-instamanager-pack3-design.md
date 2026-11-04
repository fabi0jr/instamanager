# InstaManager: design do pack 3

Data: 2026-11-05 · Decisões do Fabio. As calls do Claude estão marcadas como *(call)*.

## Por quê
O app está em uso e a liga já roda dentro dele: rodada 1 lançada, CBF, votações e stories. O pack 3 tem três objetivos:
- dar **identidade ao técnico**: perfil, níveis e conquistas;
- trazer o **resto da temporada**: calendário, Copa do Brasil e bolão;
- deixar a **CBF realmente inteligente**, com o Claude agindo via MCP.

## Restrições (as mesmas dos packs anteriores)
- Produção com dados.
- Migrações aditivas: afrouxar um `NOT NULL` é permitido, porque o código antigo continua funcionando.
- Ensaio no dump real e backup antes de cada deploy.
- QA valida pelo DOM. Print só para conferência visual.
- **Dependências aprovadas:** `@modelcontextprotocol/sdk` (onda C) e Playwright com WebKit, só no CI (onda B).
- **Fora:** mercado de contratações (item F, recusado pelo Fabio).

## Funcionalidades

### D · Perfil do técnico (onda A)
- `/u/:id` mostra nome, foto, clube atual, histórico de clubes (o `CoachTenure` que já existe), os posts que a pessoa publicou e, a partir da onda B, nível e conquistas.
- Menções, busca, atividade e comentários passam a levar para cá.

### E · Calendário: Brasileirão + Copa do Brasil (onda A)
- **Brasileirão:** o admin pode lançar os jogos de qualquer rodada **sem placar** (agendados). O placar entra depois, e a rodada só fecha com todos os placares. A tabela ignora jogo sem placar.
- **Copa do Brasil:** mata-mata em **jogo único**, e empate vai para os **pênaltis**, onde o placar dos pênaltis é obrigatório. Os confrontos de cada fase vêm do sorteio do OSM: o admin cria a fase (nome e ordem) e lança os confrontos. Não há regra fixa de quantos times. Um clube eliminado não aparece nas fases seguintes, e o app avisa se o admin tentar.
- **Tela Liga › Calendário:** próximos jogos de cada competição e a chave da Copa por fases.
- **CBF:** fechar uma fase da Copa gera uma prévia de resumo do bot. Usa as mesmas frases, mais umas 10 de mata-mata *(call)*.

### C · Bolão (onda A)
- **Quem palpita:** todos, inclusive torcedores *(call)*.
- **Quando:** cada rodada e cada fase da Copa têm um **prazo de palpite** definido pelo admin. Antes do prazo, cada pessoa só vê o próprio palpite e pode editar. Depois, ele fica travado e os de todos ficam visíveis.
- **Pontos:**
  - placar exato: **3**;
  - acertar o vencedor ou o empate: **1**;
  - na Copa, acertar **quem passa** soma **+1**. Com empate no palpite, a pessoa escolhe quem passa nos pênaltis.
- **Ranking único** (Brasileirão + Copa) na Liga › Bolão, com os "acertos exatos" como desempate.
- **Avisos:** push 2 h antes do prazo para quem ainda não palpitou. O resultado da rodada entra no resumo da CBF ("rei do bolão da rodada").

### H · Escolher quais pushes receber (onda A)
- No perfil: interruptores para posts novos, comentários no meu clube, menções, CBF, bolão e trocas. Todos começam ligados.

### B · Conquistas e níveis (onda B)
- **XP:**
  - postar: 5;
  - receber reação: 1, com teto de 50 por post;
  - vencer jogo: 10;
  - empatar: 3;
  - acertar placar no bolão: 5;
  - ganhar votação: 20.
- **Níveis:** Estagiário (0) · Auxiliar (100) · Técnico (300) · Professor (700) · Lenda (1500) *(call)*.
- **Conquistas automáticas:** primeira vitória · goleada (vencer por 3+) · invicto por 5 rodadas · líder · campeão da Copa · rei do bolão da rodada · viral (post com 50 reações) · primeiro story · comunicador (100 posts) *(call)*.
- O XP é calculado do histórico, o que permite recalcular tudo.
- Uma conquista nova gera atividade, push e um post da CBF.

### G · Responder comentário (onda B)
- Resposta com um nível só. Responder uma resposta continua na mesma linha, citando a pessoa.
- Quem recebe a resposta é avisado.

### I · Testes no Safari no CI (onda B)
- Playwright com WebKit roda alguns caminhos críticos no celular emulado: login, postar, comentar com a folha acima da barra, story e bolão.

### A · CBF inteligente via MCP (onda C)
- O back expõe um **servidor MCP remoto** em `/mcp`, protegido por uma **chave só do admin**, guardada no `.env` e trocável.
- **Ferramentas de leitura:** últimos posts e comentários, tabela, calendário, bolão e votações.
- **Ferramentas de escrita, sempre como CBF:**
  - criar post de texto;
  - criar story de texto;
  - criar votação;
  - lançar placares.
- Tudo passa pelas mesmas regras e validações dos endpoints.
- Toda ação via MCP fica registrada e aparece num log simples no admin.

## Ondas
- **A:** D, E, C, H.
- **B:** B, G, I.
- **C:** A.
