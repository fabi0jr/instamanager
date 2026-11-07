# Assessoria do Botafogo: design

Data: 2026-11-05. O que está aqui é decisão do Fabio. As decisões do Claude estão marcadas como *(call)*.

## Por quê
O Fabio agora é técnico do Botafogo na liga. Ele quer que o perfil do clube no InstaManager tenha a cara do Instagram oficial do Botafogo, com artes de resultado, escalação, próxima partida, contratação, coletiva e despedida, mas contando a história da **nossa liga**. Ele quer fazer isso falando com um terminal, como já faz com a CBF no Tribuna, sem abrir editor de imagem.

## O que é
- Um **terminal novo no canvas do Maestri**, irmão do Tribuna, que só cuida do Botafogo. Ele funciona como a assessoria de imprensa do clube.
- O Fabio cola **prints do OSM** com a partida, a escalação ou o jogador, e pede um post.
- O terminal:
  1. busca a **foto do jogador real** na internet;
  2. monta a arte num **modelo fixo** no estilo do Botafogo oficial;
  3. escreve a legenda;
  4. mostra tudo ao Fabio;
  5. depois do OK, **posta no perfil do Botafogo** na liga, como técnico e não como CBF.

## Metas
- Sete formatos (abaixo), fiéis ao estilo do @botafogo.
- Do print ao post em poucos minutos, com o Fabio só aprovando.
- Foto certa do jogador e em boa qualidade.

## Não-metas
- **Não é para os outros técnicos.** É só o Botafogo e só o Fabio. Se outro técnico quiser, isso vira outro projeto.
- **Não gera imagem com IA.** As fotos são reais, buscadas na internet.
  - **Mudou em 2026-11-07, por decisão do Fabio:** a assessoria pode fazer montagens ("jogadores se abraçando com a camisa") no app do Gemini dele, por portal no Maestri. O Fabio escolhe a versão. O app continua sem IA. Plano: `docs/superpowers/plans/2026-11-07-assessoria-montagem.md`.
- O app muda numa coisa só, por decisão do Fabio: o **feed passa a mostrar vídeo em 4:5** (hoje é quadrado e corta). Isso vale para todos os vídeos do app, como o Instagram faz com reels no feed. Fora isso, o post aparece como qualquer post do Botafogo.
- **Sem botão no app**, porque tudo acontece no terminal.

## Anti-metas (o que faria dar errado mesmo funcionando)
- **Foto do jogador errado** (homônimo, outro clube, outra pessoa).
- **Foto de baixa qualidade**: pixelada, cortada ou com marca d'água grande.
- Postar sem o Fabio ver antes.

## Os sete formatos
Todos usam a identidade do @botafogo: fundo preto, foto em preto e branco ou escurecida, títulos enormes em letra serifada condensada, preto e branco com a estrela solitária, escudos dos dois clubes. A imagem tem **1080×1350** (4:5). O vídeo também é **4:5** (1080×1350), com até 30 s, que é o limite de vídeo do app.

| Formato | Arte | Dados vêm de |
|---|---|---|
| **Fim de jogo** | Foto do autor do gol (ou de um destaque), título "FIM DE JOGO" no alto, placar enorme com os dois escudos e, embaixo, os gols com os minutos ("19' Edenilson") | Print do OSM: placar e gols. O placar é conferido com o app pelo MCP. Se não bater, ou se o jogo ainda não tem placar no app, o terminal **avisa e espera** o Fabio decidir. Ele **nunca lança placar**, porque isso é com a CBF/Tribuna *(call)*. |
| **Nossos onze** | Título "NOSSOS ONZE"; a lista com número e nome dos 11 titulares (o capitão com ©); o técnico; os reservas em letra pequena; os escudos embaixo; foto de um jogador ocupando a direita | Print da escalação do OSM |
| **Próxima partida** (imagem) | "BRASILEIRÃO 2026 \| Nª RODADA" (ou a fase da Copa), "PRÓXIMA PARTIDA", foto de estádio, "BOTAFOGO VS ADVERSÁRIO", estádio, data e hora | Calendário do app pelo MCP. O estádio é sempre o do mandante *(call)*. |
| **Próxima partida** (vídeo) | A mesma informação, animada: foto do jogador, os escudos "VS" e a data | Igual ao de cima |
| **Contratação** (vídeo) | Foto do jogador, nome enorme, idade · posição, "TEMPORADA 2026", escudo | Print do jogador no OSM |
| **Coletiva** | **Uma imagem só**, no estilo "NOTA OFICIAL" do @botafogo: foto da torcida em preto e branco bem escura e "COLETIVA" enorme no centro. **A fala do Fabio vai inteira na legenda.** | O Fabio dita ou escreve a fala |
| **Despedida** | Foto do jogador e "OBRIGADO" enorme | O Fabio diz quem saiu. A legenda conta para onde ele foi. |

**Legendas:** o tom do @botafogo oficial (frases curtas, maiúsculas de impacto, emojis 🔥💪⭐, `#VamosBOTAFOGO`), falando da nossa liga, com rodada, adversário e técnico adversário quando fizer sentido. Pode ter zoeira leve, como a da CBF, mas sem ofender ninguém.

**Vídeos:** animação simples feita em cima do modelo, com o texto entrando, um zoom lento na foto e o placar ou o nome aparecendo *(call)*. Sem áudio. Na v1 não dá para copiar o motion do Botafogo quadro a quadro.

## Fotos (a parte que mais importa)
- **Busca:** o jogador real pelo nome e pelo clube na vida real, preferindo fontes abertas, como a Wikipédia e o Wikimedia Commons, e depois a busca geral da web.
- **O Fabio escolhe:** o terminal mostra **2 ou 3 candidatas**, com a fonte de cada uma, e o Fabio escolhe. O terminal **nunca escolhe sozinho** a primeira foto de um jogador.
- **Qualidade mínima:** **1000 px no lado menor**. Abaixo disso, a foto é descartada. Foto com marca d'água grande também.
- **Banco de fotos:** a foto aprovada fica guardada por jogador e é reaproveitada sem perguntar de novo. O Fabio pode pedir para trocar.
- **Fotos genéricas** (torcida, estádio): ficam num banco à parte, escolhidas uma vez.
- O banco **não vai para o git**, porque são fotos de terceiros. Fica no `.gitignore`. O grupo é fechado, e o Fabio aceita o uso. Sem foto aprovada, o terminal não posta.

## Como é feito *(calls do Claude, salvo onde indicado)*
- **Uma pasta `assessoria/` no repo**, com:
  - os modelos em HTML/CSS, um por formato;
  - o script que preenche o modelo e tira a "foto" com o **Chrome headless** que já está instalado;
  - o script que anima com o **ffmpeg** que já está instalado.

  A pasta não entra no build do app nem no deploy.
- **Fontes:** fontes livres (licença OFL) parecidas com as do Botafogo (serifada condensada para os títulos e sem serifa condensada para os textos), guardadas dentro de `assessoria/`. Nada de fonte carregada da internet na hora.
- **Escudos:** os que o app já tem (`front/public/escudos/`).
- **Revisão antes de postar:** o terminal salva a arte e mostra o caminho e a legenda. O Fabio vê a imagem e diz "posta" ou o que mudar.
- **Postar como Botafogo:** é preciso uma **ferramenta nova no MCP**, `postar_no_clube`, porque hoje o MCP só posta como CBF.
  - Ela posta no clube do **admin**, que hoje é o Fabio, técnico do Botafogo. Admin sem clube recebe erro.
  - Aceita imagens (1 a 10, JPEG) **ou** um vídeo (MP4 de até 30 s), mais a legenda.
  - Passa pelo mesmo `PostsService.criar` dos posts normais: mesmas validações, push normal para quem segue, conquistas e XP de postar.
  - Fica registrada no log do MCP no admin, como as outras ferramentas de escrita.
  - O app exige uma **miniatura** de cada imagem. Quem gera é o builder decide: o terminal ou o back, que já tem ffmpeg.
  - O limite de corpo do `/mcp` precisa subir, porque hoje é 1 MB para tudo. Vídeo e imagens em base64 passam disso. O limite é decisão do builder, sem afetar o `/api`.
- **Terminal:** papel novo no Maestri, no estilo do Tribuna:
  - pasta do projeto, para o MCP `cbf` local funcionar;
  - mostra antes de postar;
  - não mexe em código nem em git, só em `assessoria/`, para gerar as saídas e o banco de fotos.

## Referências visuais
- Os prints do @botafogo vistos no portal (fim de jogo, nossos onze, próxima partida, quadros do reel de contratação e do reel de próxima partida, e nota oficial) ficam em `assessoria/referencias/`, fora do git *(call)*.
- O builder também pode abrir o portal "Insta Botafogo" do Maestri, que já está logado na conta do Fabio, para ver mais posts.

## Detalhes técnicos já decididos *(calls)*
- **Log do MCP:** o log de `postar_no_clube` guarda só a legenda e a contagem de mídias, **nunca os bytes em base64**.
- **Estádios:** os estádios não existem no app. Uma tabela clube → estádio fica em `assessoria/`.
- **nginx do `/mcp`:** o limite de corpo e o timeout sobem para caber um vídeo de até 30 s mais a conversão. Subir isso para a VPS é deploy, com a confirmação do Fabio.
- **Papel do terminal:** é criado pelo Maestro no Maestri, como o do Tribuna. As regras "mostrar antes de postar" e "nunca escolher foto sozinho" ficam no papel e também num `assessoria/CLAUDE.md`.

## O que fica com o builder
- O layout exato de cada modelo, a partir dos prints do @botafogo vistos no portal (fim de jogo, nossos onze, próxima partida, contratação e nota oficial).
- O formato do banco de fotos (por exemplo, `assessoria/fotos/<jogador>.jpg` mais um índice com a fonte).
- A animação exata dos vídeos.

## Fora desta versão
- Outros clubes e outros técnicos.
- Carrossel com várias artes no mesmo post (só se sair de graça).
- Recorte do jogador (tirar o fundo da foto), porque exigiria uma ferramenta nova de IA. A foto entra inteira, com degradê.
