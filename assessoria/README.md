# Assessoria do Botafogo: gerador de artes

Transforma dados (do print do OSM) em arte 1080×1350 (JPEG) ou vídeo 4:5 (MP4, 8 s, sem áudio) no estilo do @botafogo. Fora do build e do deploy do app. Sem dependência npm: Node, `/usr/bin/google-chrome` (headless) e `/usr/bin/ffmpeg`.

## Uso
```
node assessoria/gerar.mjs <formato> <dados.json>
node assessoria/gerar.mjs exemplos      # foto de teste (ffmpeg) + um exemplo de cada formato
node --test assessoria/gerar.test.mjs
```
Saída em `assessoria/saidas/<AAAA-MM-DD>-<formato>[-2…]/` (nunca sobrescreve) e os caminhos saem em JSON:
- imagem: `arte.jpg` (1080×1350) e `mini.jpg` (400 px no lado maior);
- vídeo: `video.mp4` e `capa.jpg`.

## Formatos e dados
Clubes por id do app (`botafogo`, `atletico-mg`…, veja `estadios.json`). `foto` é um caminho (relativo à raiz do repo ou absoluto). Exemplos em `exemplos/`.

| Formato | Dados |
|---|---|
| `fim-de-jogo` | `mandante, visitante, golsMandante, golsVisitante, gols:[{minuto, jogador, clube}], foto` |
| `nossos-onze` | `adversario, titulares:[{numero, nome, capitao?}] (11), tecnico, reservas:[{numero, nome}], foto` |
| `proxima-partida` / `proxima-partida-video` | `competicao, rodadaOuFase, mandante, visitante, estadio?, dataHora (ISO), foto` |
| `contratacao-video` | `nome, idade, posicao, foto` |
| `coletiva` | `foto?` (sem ela usa `fotos/genericas/torcida.jpg`) |
| `despedida` | `nome, foto` |

Faltou campo ou clube desconhecido: erro dizendo qual campo, saída 1.

## Como funciona
- `modelos/<formato>.html` + `modelos/base.css`: o modelo; `{{x}}` escapa, `{{{x}}}` é HTML montado no `gerar.mjs`.
- `modelos/fit.js` roda no Chrome antes da captura e reduz a letra dos `[data-fit]` até caber (grava `data-fonte`/`data-cabe`; o teste lê isso).
- Vídeo: duas capturas (fundo e textos em PNG transparente) e o ffmpeg faz zoom lento no fundo e entrada dos textos (fade + subida).
- Fontes: `fontes/` (Instrument Serif, OFL, para os títulos) e Barlow Condensed de `front/public/fonts`.

## Limites conhecidos
- `estadios.json` foi escrito de memória: confira os nomes dos estádios.
- Não valida a qualidade da foto (1000 px no lado menor): isso é do banco de fotos do terminal.
- Duração do vídeo fixa em 8 s.
