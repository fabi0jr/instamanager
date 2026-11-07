# Assessoria do Botafogo: gerador de artes

Transforma dados (do print do OSM) em arte 1080×1350 (JPEG) ou vídeo 4:5 (MP4, 8 s, sem áudio) no estilo do @botafogo. Fora do build e do deploy do app. Sem dependência npm: Node, `/usr/bin/google-chrome` (headless) e `/usr/bin/ffmpeg`.

## Uso
```
node assessoria/gerar.mjs <formato> <dados.json>
node assessoria/gerar.mjs exemplos      # foto de teste (ffmpeg) + um exemplo de cada formato
node --test assessoria/*.test.mjs
```
Saída em `assessoria/saidas/<AAAA-MM-DD>-<formato>[-2…]/` (nunca sobrescreve) e os caminhos saem em JSON:
- imagem: `arte.jpg` (1080×1350) e `mini.jpg` (800 px no lado maior, igual à miniatura do app);
- vídeo: `video.mp4` e `capa.jpg`.

## Formatos e dados
`foto` só vale dentro de `assessoria/fotos/` (`../` ou caminho de fora dá erro). Clubes por id do app (`botafogo`, `atletico-mg`…, veja `estadios.json`). `foto` é um caminho (relativo à raiz do repo ou absoluto). Exemplos em `exemplos/`.

| Formato | Dados |
|---|---|
| `fim-de-jogo` | `mandante, visitante, golsMandante, golsVisitante, gols:[{minuto, jogador, clube}], foto` |
| `nossos-onze` | `adversario, titulares:[{numero, nome, capitao?}] (11), tecnico, reservas:[{numero, nome}], foto` |
| `proxima-partida` / `proxima-partida-video` | `competicao, rodadaOuFase, mandante, visitante, estadio?, dataHora (ISO), foto` |
| `contratacao-video` | `nome, idade, posicao, foto` |
| `coletiva` | `foto?` (sem ela usa `fotos/genericas/torcida.jpg`) |
| `despedida` | `nome, foto` |

Faltou campo ou clube desconhecido: erro dizendo qual campo, saída 1.

## Montagem
Montagem com IA no app do Gemini (o terminal usa o portal). Dois comandos, em `assessoria/montagem.mjs`:
```
node assessoria/montagem.mjs preparar <pedido.json>
node assessoria/montagem.mjs receber <pasta-da-montagem> <arquivo>
```
- `preparar`: `pedido = {texto, fotos:[1 a 4], camisa?, versoes? (1 a 4, padrão 3)}`. Fotos e camisa (padrão `fotos/genericas/camisa.jpg`) precisam estar em `assessoria/fotos/`. Cria `saidas/<AAAA-MM-DD>-montagem[-2…]/` com `ref-1.jpg…`, `camisa.jpg` (até 1536 px no lado maior) e `pedido.txt` (seu texto + a parte fixa). Imprime `{pasta, referencias, pedido, versoes}`.
- `receber`: pega a imagem que veio do Gemini (caminho relativo vale a partir de onde o comando roda) (JPEG, PNG ou WebP, mínimo 800 px no lado menor) e grava o próximo `vN.jpg` em 1080×1350, recortado sem deformar. Recusa miniatura, HTML de erro e arquivo vazio, sem gravar nada. Imprime `{versao}`.
- Formato `foto`: `node assessoria/gerar.mjs foto <dados.json>` com `{foto}` (em `assessoria/fotos/` ou `assessoria/saidas/`) grava `arte.jpg` (1080×1350, recortada) e `mini.jpg`, sem modelo HTML.

## Postar
```
node assessoria/postar.mjs assessoria/saidas/<pasta>
```
A pasta precisa estar dentro de `assessoria/saidas/` e ter `legenda.txt` (a legenda vem **sempre** daí: o comando não aceita outro arquivo nem segundo argumento) mais `arte.jpg` + `mini.jpg` ou `video.mp4`. Todo arquivo lido, inclusive pelo caminho real (link simbólico), tem de ficar em `saidas/`. O comando monta o base64 e chama `postar_no_clube` no MCP por HTTP (initialize e tools/call). Imprime o id do post; erro da ferramenta (`isError`) sai com código 1. Config no `.env` da raiz ou no ambiente: `ASSESSORIA_MCP_CHAVE` (a mesma do `MCP_CHAVE` do servidor; ASCII visível, sem espaços; nunca é impressa) e `ASSESSORIA_MCP_URL` (padrão `https://instamanager.fj-dev.tech/mcp`).

## Como funciona
- `modelos/<formato>.html` + `modelos/base.css`: o modelo; `{{x}}` escapa, `{{{x}}}` é HTML montado no `gerar.mjs`.
- `modelos/fit.js` roda no Chrome antes da captura e reduz a letra dos `[data-fit]` até caber (grava `data-fonte`/`data-cabe`; o teste lê isso).
- Vídeo: duas capturas (fundo e textos em PNG transparente) e o ffmpeg faz zoom lento no fundo e entrada dos textos (fade + subida).
- Fontes: `fontes/` (Instrument Serif, OFL, para os títulos) e Barlow Condensed de `front/public/fonts`.

## Limites conhecidos
- `estadios.json` foi escrito de memória: confira os nomes dos estádios.
- Não valida a qualidade da foto (1000 px no lado menor): isso é do banco de fotos do terminal.
- Duração do vídeo fixa em 8 s.
