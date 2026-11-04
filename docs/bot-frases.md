# Frases do bot da zoeira (CBF)

> **Para o Fabio revisar antes do deploy.** São 72 frases prontas, em `back/src/bot/frases.ts` (esta página é a mesma lista). Para mudar uma frase, edite o arquivo e rode o teste; o bot nunca escreve nada que não esteja aqui.

Como funciona: depois que o admin fecha a rodada, o bot detecta o que aconteceu (goleada, lanterna, queda, líder, sequência de derrotas, Z4, fim de jejum, empates) e junta de 3 a 6 frases, sem repetir, até 500 caracteres. Cada frase vai numa linha. O admin pode **sortear de novo**, **editar** o texto e só então **publicar**. `{tecnico}` vira o nome do técnico do clube (e ele recebe um push por ter sido citado); clube sem técnico usa as frases "sem técnico". Regra de tom: só zoeira do desempenho no jogo, sem palavrão e sem ofensa pessoal.

Exemplo de saída: `{clube}` = Corinthians, `{outro}` = Vasco da Gama, `{placar}` = "4 a 0".

## Abertura (sempre a 1ª frase)

Variáveis: `{n}`

**Sem técnico:**

- Rodada {n} no bolso! Hora do resumo da CBF.
- A CBF passa para avisar: a rodada {n} acabou, e tem gente com muito o que explicar.
- Rodada {n} encerrada. O VAR da zoeira entra em campo.
- Boletim da rodada {n}: sentem-se, que lá vem história.

## Maior goleada (zoa quem tomou, saldo ≥ 3)

Variáveis: `{clube}`, `{tecnico}`, `{outro}`, `{placar}`

**Com o técnico (usa `{tecnico}`):**

- {clube} tomou {placar} do {outro}. {tecnico} jura que foi só um mau dia.
- {placar} para o {outro} em cima do {clube}. {tecnico}, o time foi viajar sem avisar?
- O {clube} foi atropelado pelo {outro} por {placar}. {tecnico} já pediu para esquecer o jogo.

**Sem técnico:**

- {clube} tomou {placar} do {outro}. Foi treino com camisa de jogo.
- {outro} passou por cima do {clube}: {placar}. A zaga mandou lembranças.
- {placar} é placar de handebol, mas quem sofreu foi o {clube}, contra o {outro}.

## Um derrotado da rodada

Variáveis: `{clube}`, `{tecnico}`, `{outro}`, `{placar}`

**Com o técnico (usa `{tecnico}`):**

- {clube} perdeu para o {outro} ({placar}). {tecnico} promete melhorar na semana.
- Derrota do {clube} para o {outro}, {placar}. {tecnico} culpa o gramado, claro.
- {tecnico} viu o {clube} cair diante do {outro} por {placar} e já ensaia a entrevista.

**Sem técnico:**

- {clube} perdeu para o {outro} por {placar}. Quem sabe na próxima.
- O {outro} levou a melhor sobre o {clube}: {placar}.
- Não foi dessa vez, {clube}: {placar} para o {outro}.

## Novo lanterna

Variáveis: `{clube}`, `{tecnico}`, `{pontos}`

**Com o técnico (usa `{tecnico}`):**

- {clube} é o novo lanterna, com {pontos} pontos. {tecnico} diz que lanterna ilumina o caminho.
- Lanterna novo no pedaço: {clube}. {tecnico}, a luz acendeu?
- {tecnico} assume a lanterna com o {clube}. Pelo menos é líder de alguma coisa.

**Sem técnico:**

- {clube} despencou para o último lugar, com {pontos} pontos.
- Quem é o novo lanterna? {clube}, com {pontos} pontos.
- O último lugar tem novo dono: {clube}.

## Quem despencou (≥ 3 posições)

Variáveis: `{clube}`, `{tecnico}`, `{n}`, `{pos}`

**Com o técnico (usa `{tecnico}`):**

- {clube} caiu {n} posições e está em {pos}º. {tecnico} jura que é só uma fase.
- {tecnico} viu o {clube} despencar {n} lugares na tabela. O elevador quebrou?
- {clube}: {n} posições para baixo, agora em {pos}º. {tecnico} pediu para não falar disso.

**Sem técnico:**

- {clube} despencou {n} posições e agora é {pos}º.
- Elevador descendo: {clube} perdeu {n} posições.
- {n} posições a menos para o {clube}, que agora está em {pos}º.

## Líder isolado

Variáveis: `{clube}`, `{tecnico}`, `{pontos}`

**Com o técnico (usa `{tecnico}`):**

- {clube} lidera isolado com {pontos} pontos. {tecnico} já pode ir ensaiando a faixa.
- Líder isolado: {clube}! {tecnico} está calmo, mas ninguém acredita.
- {tecnico} comanda o {clube} na ponta, com {pontos} pontos. Sem pressão.

**Sem técnico:**

- {clube} lidera sozinho, com {pontos} pontos.
- O topo tem dono: {clube}, isolado, com {pontos} pontos.
- Sozinho na ponta: {clube} ({pontos} pontos).

## 3 ou mais derrotas seguidas

Variáveis: `{clube}`, `{tecnico}`, `{n}`

**Com o técnico (usa `{tecnico}`):**

- {n} derrotas seguidas do {clube}. {tecnico}, tá tudo bem aí?
- {tecnico} já perdeu a conta: são {n} derrotas seguidas do {clube}.
- {clube} chega a {n} derrotas seguidas. {tecnico} sugere mudar de assunto.

**Sem técnico:**

- {n} derrotas seguidas do {clube}. A fila só anda para trás.
- Sequência feia: {n} derrotas seguidas do {clube}.
- {clube} soma {n} derrotas seguidas e a torcida já pede milagre.

## Entrou no Z4

Variáveis: `{clube}`, `{tecnico}`, `{pos}`

**Com o técnico (usa `{tecnico}`):**

- {clube} entrou no Z4 e está em {pos}º. {tecnico}, hora de acender o alerta.
- {tecnico} viu o {clube} cair para a zona de rebaixamento ({pos}º lugar).
- Z4 na área: o {clube} é {pos}º. {tecnico} diz que ainda dá tempo.

**Sem técnico:**

- {clube} entrou no Z4 e é o {pos}º colocado.
- Alerta vermelho: {clube} caiu para a zona de rebaixamento.
- Bem-vindo ao Z4, {clube}: {pos}º lugar.

## Fim de jejum (venceu depois de ≥ 3 jogos sem vencer)

Variáveis: `{clube}`, `{tecnico}`, `{n}`

**Com o técnico (usa `{tecnico}`):**

- {clube} voltou a vencer depois de {n} jogos sem vitória. {tecnico} já pode respirar.
- Acabou o jejum! {tecnico} comemora a vitória do {clube} após {n} jogos.
- {tecnico} e o {clube} quebraram o jejum de {n} jogos sem vencer.

**Sem técnico:**

- O {clube} venceu depois de {n} jogos sem vitória.
- Fim de jejum: {clube} voltou a ganhar.
- Milagre confirmado: o {clube} ganhou depois de {n} jogos.

## Rodada com 2 ou mais empates

Variáveis: `{n}`

**Sem técnico:**

- Foram {n} empates na rodada: ninguém quis ganhar de ninguém.
- {n} empates por aí. Tanto esforço para ficar no meio-termo.
- Rodada do meio-termo: {n} empates.

## Fecho, quando faltam frases

Variáveis: nenhuma

**Sem técnico:**

- No fim, quem manda é a tabela. E ela não perdoa.
- Semana que vem tem mais, e a zoeira também.
- Rodada boa para quem ganhou, ótima para quem comenta.
- O resumo é esse. Reclamações, no grupo.

## Copa do Brasil · mata-mata (NOVAS, 10 frases: revise)

Quando o admin **fecha uma fase** da Copa, o bot monta a prévia do resumo: 1 frase de abertura + 1 frase por jogo (até 5, sorteados), sem repetir, até 500 caracteres. Quem perdeu é o "eliminado"; o técnico dele só é citado (e recebe o push "A CBF citou você") nas frases "com técnico". Jogo decidido nos pênaltis usa as frases de pênaltis, e o `{placar}` ali é o dos pênaltis. O admin pode editar antes de publicar.

### Abertura da fase

Variáveis: `{fase}`

**Sem técnico:**

- Acabou a fase "{fase}" da Copa do Brasil! Quem sobrou segue vivo, o resto vai para casa.
- Mata-mata é assim: fechou a fase "{fase}" e ninguém tem segunda chance.

### Eliminado no tempo normal

Variáveis: `{clube}` (o eliminado), `{tecnico}`, `{outro}` (quem passou), `{placar}`, `{fase}`

**Com o técnico:**

- {clube} está fora da Copa: {placar} para o {outro}. {tecnico} já volta a olhar só a tabela.
- {tecnico} viu o {clube} cair para o {outro} ({placar}). Em jogo único não tem revanche.

**Sem técnico:**

- Adeus, Copa! O {clube} perdeu para o {outro} por {placar} e foi eliminado.
- {outro} despachou o {clube} ({placar}). Jogo único não perdoa.

### Eliminado nos pênaltis

Variáveis: `{clube}` (o eliminado), `{tecnico}`, `{outro}`, `{placar}` (dos pênaltis)

**Com o técnico:**

- {tecnico} sofreu nos pênaltis: o {clube} caiu para o {outro} por {placar}. Haja coração!
- {clube} perdeu da marca da cal para o {outro} ({placar}). {tecnico} diz que foi falta de sorte.

**Sem técnico:**

- Decidiu nos pênaltis! O {outro} passou pelo {clube} por {placar}.
- Pênaltis cruéis: {clube} fora da Copa, e o {outro} avança por {placar}.

## Fecho do resumo · rei do bolão (NOVAS, 3 frases: revise)

Entra como última linha do resumo da rodada ou da fase quando alguém pontuou no bolão (o líder daquela rodada/fase; sem ninguém pontuando, a linha não aparece). Se o texto passar de 500 caracteres, essa linha é a primeira a sair.

Variáveis: `{rei}` (nome de quem liderou), `{pontos}`

**Sem técnico:**

- Rei do bolão da vez: {rei}, com {pontos} na conta. Palpite não tem VAR.
- Quem mandou bem no bolão foi {rei}: {pontos} na soma. Os outros que se expliquem.
- {rei} é o rei do bolão, com {pontos} na soma. Reverência, por favor.
