// Frases prontas do bot da CBF. Só zoeira de futebol: o alvo é o desempenho no jogo, nunca a pessoa.
// `com` usa {tecnico} (só entra quando o clube tem técnico); `sem` serve para qualquer clube.
// Variáveis por categoria: ver VARIAVEIS. O Fabio revisa esta lista (docs/bot-frases.md) antes do deploy.
export type Categoria = 'abertura' | 'goleada' | 'derrota' | 'lanterna' | 'queda' | 'lider' | 'sequencia' | 'z4' | 'jejum' | 'empates' | 'geral' | 'copaAbertura' | 'copaEliminado' | 'copaPenaltis';

export const VARIAVEIS: Record<Categoria, string[]> = {
  abertura: ['n'],
  goleada: ['clube', 'tecnico', 'outro', 'placar'],
  derrota: ['clube', 'tecnico', 'outro', 'placar'],
  lanterna: ['clube', 'tecnico', 'pontos'],
  queda: ['clube', 'tecnico', 'n', 'pos'],
  lider: ['clube', 'tecnico', 'pontos'],
  sequencia: ['clube', 'tecnico', 'n'],
  z4: ['clube', 'tecnico', 'pos'],
  jejum: ['clube', 'tecnico', 'n'],
  empates: ['n'],
  geral: [],
  copaAbertura: ['fase'],
  copaEliminado: ['clube', 'tecnico', 'outro', 'placar', 'fase'], // clube = o eliminado
  copaPenaltis: ['clube', 'tecnico', 'outro', 'placar'], // placar = o dos pênaltis
};

export const FRASES: Record<Categoria, { sem: string[]; com: string[] }> = {
  abertura: {
    sem: [
      'Rodada {n} no bolso! Hora do resumo da CBF.',
      'A CBF passa para avisar: a rodada {n} acabou, e tem gente com muito o que explicar.',
      'Rodada {n} encerrada. O VAR da zoeira entra em campo.',
      'Boletim da rodada {n}: sentem-se, que lá vem história.',
    ],
    com: [],
  },
  goleada: {
    com: [
      '{clube} tomou {placar} do {outro}. {tecnico} jura que foi só um mau dia.',
      '{placar} para o {outro} em cima do {clube}. {tecnico}, o time foi viajar sem avisar?',
      'O {clube} foi atropelado pelo {outro} por {placar}. {tecnico} já pediu para esquecer o jogo.',
    ],
    sem: [
      '{clube} tomou {placar} do {outro}. Foi treino com camisa de jogo.',
      '{outro} passou por cima do {clube}: {placar}. A zaga mandou lembranças.',
      '{placar} é placar de handebol, mas quem sofreu foi o {clube}, contra o {outro}.',
    ],
  },
  derrota: {
    com: [
      '{clube} perdeu para o {outro} ({placar}). {tecnico} promete melhorar na semana.',
      'Derrota do {clube} para o {outro}, {placar}. {tecnico} culpa o gramado, claro.',
      '{tecnico} viu o {clube} cair diante do {outro} por {placar} e já ensaia a entrevista.',
    ],
    sem: [
      '{clube} perdeu para o {outro} por {placar}. Quem sabe na próxima.',
      'O {outro} levou a melhor sobre o {clube}: {placar}.',
      'Não foi dessa vez, {clube}: {placar} para o {outro}.',
    ],
  },
  lanterna: {
    com: [
      '{clube} é o novo lanterna, com {pontos} pontos. {tecnico} diz que lanterna ilumina o caminho.',
      'Lanterna novo no pedaço: {clube}. {tecnico}, a luz acendeu?',
      '{tecnico} assume a lanterna com o {clube}. Pelo menos é líder de alguma coisa.',
    ],
    sem: [
      '{clube} despencou para o último lugar, com {pontos} pontos.',
      'Quem é o novo lanterna? {clube}, com {pontos} pontos.',
      'O último lugar tem novo dono: {clube}.',
    ],
  },
  queda: {
    com: [
      '{clube} caiu {n} posições e está em {pos}º. {tecnico} jura que é só uma fase.',
      '{tecnico} viu o {clube} despencar {n} lugares na tabela. O elevador quebrou?',
      '{clube}: {n} posições para baixo, agora em {pos}º. {tecnico} pediu para não falar disso.',
    ],
    sem: [
      '{clube} despencou {n} posições e agora é {pos}º.',
      'Elevador descendo: {clube} perdeu {n} posições.',
      '{n} posições a menos para o {clube}, que agora está em {pos}º.',
    ],
  },
  lider: {
    com: [
      '{clube} lidera isolado com {pontos} pontos. {tecnico} já pode ir ensaiando a faixa.',
      'Líder isolado: {clube}! {tecnico} está calmo, mas ninguém acredita.',
      '{tecnico} comanda o {clube} na ponta, com {pontos} pontos. Sem pressão.',
    ],
    sem: [
      '{clube} lidera sozinho, com {pontos} pontos.',
      'O topo tem dono: {clube}, isolado, com {pontos} pontos.',
      'Sozinho na ponta: {clube} ({pontos} pontos).',
    ],
  },
  sequencia: {
    com: [
      '{n} derrotas seguidas do {clube}. {tecnico}, tá tudo bem aí?',
      '{tecnico} já perdeu a conta: são {n} derrotas seguidas do {clube}.',
      '{clube} chega a {n} derrotas seguidas. {tecnico} sugere mudar de assunto.',
    ],
    sem: [
      '{n} derrotas seguidas do {clube}. A fila só anda para trás.',
      'Sequência feia: {n} derrotas seguidas do {clube}.',
      '{clube} soma {n} derrotas seguidas e a torcida já pede milagre.',
    ],
  },
  z4: {
    com: [
      '{clube} entrou no Z4 e está em {pos}º. {tecnico}, hora de acender o alerta.',
      '{tecnico} viu o {clube} cair para a zona de rebaixamento ({pos}º lugar).',
      'Z4 na área: o {clube} é {pos}º. {tecnico} diz que ainda dá tempo.',
    ],
    sem: [
      '{clube} entrou no Z4 e é o {pos}º colocado.',
      'Alerta vermelho: {clube} caiu para a zona de rebaixamento.',
      'Bem-vindo ao Z4, {clube}: {pos}º lugar.',
    ],
  },
  jejum: {
    com: [
      '{clube} voltou a vencer depois de {n} jogos sem vitória. {tecnico} já pode respirar.',
      'Acabou o jejum! {tecnico} comemora a vitória do {clube} após {n} jogos.',
      '{tecnico} e o {clube} quebraram o jejum de {n} jogos sem vencer.',
    ],
    sem: [
      'O {clube} venceu depois de {n} jogos sem vitória.',
      'Fim de jejum: {clube} voltou a ganhar.',
      'Milagre confirmado: o {clube} ganhou depois de {n} jogos.',
    ],
  },
  empates: {
    sem: [
      'Foram {n} empates na rodada: ninguém quis ganhar de ninguém.',
      '{n} empates por aí. Tanto esforço para ficar no meio-termo.',
      'Rodada do meio-termo: {n} empates.',
    ],
    com: [],
  },
  geral: {
    sem: [
      'No fim, quem manda é a tabela. E ela não perdoa.',
      'Semana que vem tem mais, e a zoeira também.',
      'Rodada boa para quem ganhou, ótima para quem comenta.',
      'O resumo é esse. Reclamações, no grupo.',
    ],
    com: [],
  },
  // Copa do Brasil (mata-mata de jogo único): resumo da fase
  copaAbertura: {
    sem: [
      'Acabou a fase "{fase}" da Copa do Brasil! Quem sobrou segue vivo, o resto vai para casa.',
      'Mata-mata é assim: fechou a fase "{fase}" e ninguém tem segunda chance.',
    ],
    com: [],
  },
  copaEliminado: {
    com: [
      '{clube} está fora da Copa: {placar} para o {outro}. {tecnico} já volta a olhar só a tabela.',
      '{tecnico} viu o {clube} cair para o {outro} ({placar}). Em jogo único não tem revanche.',
    ],
    sem: [
      'Adeus, Copa! O {clube} perdeu para o {outro} por {placar} e foi eliminado.',
      '{outro} despachou o {clube} ({placar}). Jogo único não perdoa.',
    ],
  },
  copaPenaltis: {
    com: [
      '{tecnico} sofreu nos pênaltis: o {clube} caiu para o {outro} por {placar}. Haja coração!',
      '{clube} perdeu da marca da cal para o {outro} ({placar}). {tecnico} diz que foi falta de sorte.',
    ],
    sem: [
      'Decidiu nos pênaltis! O {outro} passou pelo {clube} por {placar}.',
      'Pênaltis cruéis: {clube} fora da Copa, e o {outro} avança por {placar}.',
    ],
  },
};
