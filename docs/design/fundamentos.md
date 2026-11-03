# Fundamentos visuais (IM-17, Task D1)

Direção **Apito**: carvão e giz, com o cartão vermelho como único acento. Fonte da verdade visual: Penpot, projeto InstaManager, página **Fundamentos** (boards Logo, Paleta, Tipografia, Icones, Componentes). Os tokens também estão na biblioteca do Penpot (cores `im/*` e conjunto de tokens `global`).

Regras que valem para todo o app:
- Celular primeiro, 390 px de largura. Alvo de toque mínimo 44 × 44 px.
- O post **não tem manchete**: só imagens, legenda e prompt. Barlow Condensed fica para nome do clube, cabeçalhos, logo e números.
- O vermelho é só para ação principal, curtida e marca. Erro usa `--im-vermelho-texto` com ícone e frase, nunca só a cor.

## Tokens (`front/src/tokens.css`)

```css
:root {
  /* cor */
  --im-carvao: #0E0F11;           /* fundo do app */
  --im-superficie: #17191C;       /* card, barra, campo */
  --im-superficie-alta: #202327;  /* pílula, botão secundário, toque, esqueleto */
  --im-linha: #2C2F34;            /* divisor e borda */
  --im-giz: #F2EFE6;              /* texto principal */
  --im-giz-2: #A8A79F;            /* texto secundário */
  --im-giz-3: #74756F;            /* dica e ícone inativo (não use em texto corrido) */
  --im-vermelho: #D2261F;         /* botão primário, curtida, marca */
  --im-vermelho-press: #A81D18;   /* botão pressionado */
  --im-vermelho-texto: #FF625A;   /* erro em texto, ícone e borda */
  --im-gramado: #2FA866;          /* sucesso */
  --im-amarelo: #F2B705;          /* aviso */

  /* fonte (arquivos locais, sem Google Fonts) */
  --im-fonte-display: "Barlow Condensed", "Arial Narrow", sans-serif;
  --im-fonte-texto: "Inter", system-ui, sans-serif;

  /* espaço (base 4) */
  --im-e1: 4px;  --im-e2: 8px;  --im-e3: 12px; --im-e4: 16px;
  --im-e5: 20px; --im-e6: 24px; --im-e8: 32px; --im-e12: 48px;

  /* raio */
  --im-r-btn: 10px;    /* botão e campo */
  --im-r-midia: 12px;  /* cards soltos (estados vazio/erro), imagem no desktop */
  --im-r-folha: 20px;  /* folha inferior / modal */
  --im-r-pilula: 999px;

  /* movimento */
  --im-pulso: 1.2s ease-in-out infinite; /* esqueleto: opacidade 100% → 60% */
  --im-giro: 0.9s linear infinite;       /* spinner */
}
@media (prefers-reduced-motion: reduce) { :root { --im-pulso: 0s; --im-giro: 0s; } }
```

Contraste medido sobre `--im-carvao` (WCAG): giz 16,7:1 · giz-2 7,9:1 · giz-3 4,1:1 · vermelho-texto 6,5:1 · gramado 6,3:1 · amarelo 10,5:1. Texto giz sobre `--im-vermelho` (botão): 4,5:1. O vermelho puro sobre carvão dá 3,7:1: serve para ícone grande e preenchimento, **não** para texto.

## Tipografia

Barlow Condensed (pesos 600, 700, 800) e Inter (400, 500, 600), OFL. Hospedar em `front/public/fonts/` com `@font-face` e `font-display: swap`. Fonte dos arquivos: pacotes `@fontsource/barlow-condensed` e `@fontsource/inter` (copiar os `.woff2` latin e latin-ext; **dependência nova só para copiar arquivo: portão do Fabio**, ou baixar os `.woff2` à mão).

| Token | Família e peso | Tamanho/linha | Uso |
|---|---|---|---|
| `titulo-1` | Barlow Condensed 700 | 32/34 | título de tela |
| `titulo-2` | Barlow Condensed 700 | 24/28 e 20/24 no card | nome do clube |
| `titulo-3` | Barlow Condensed 600, +0,2 px | 20/24 | seção |
| `numero` | Barlow Condensed 600, +0,2 px | 16/20 | curtidas e contagens |
| `corpo` | Inter 400 | 15/22 (1,45) | legenda, texto |
| `corpo-forte` | Inter 600 | 15/22 | nome de pessoa, autor da legenda |
| `legenda` | Inter 400 | 13/18 | data, “por Lincoln”, ajuda |
| `micro` | Inter 500 | 12/16 | etiquetas |
| `botao` | Inter 600 | 16/20 | rótulo de botão |
| `logo` | Barlow Condensed 800, −1 px | 68 | nome “InstaManager” |

Sentença normal, sem caixa-alta, exceto a sigla da pílula (3 letras) e o “IM” do selo. Linha de texto corrido: até 70 caracteres (no celular já cabe).

## Logo

- **Selo**: círculo `--im-vermelho`, anel interno giz a 55%, “IM” em Barlow Condensed 800 (50% do diâmetro) e um apito pequeno embaixo. Com apito a partir de 96 px; abaixo disso, só “IM” (tamanhos 64, 40, 32).
- **Ícone do app / PWA**: quadrado 160 com raio 36 (22,5%), vermelho, “IM” giz centralizado. Exportar 192 e 512 (e 512 *maskable* com o “IM” dentro de 60% do centro).
- **Marca horizontal**: selo 96 + “InstaManager” (Barlow Condensed 800, 68) + assinatura “o jornal do grupo” (Inter 400, 16, giz-2). Área livre = metade da altura do “I”.
- Medidas exatas e geometria do apito: board **Logo** no Penpot (exportar SVG de lá).

## Ícones

Grade 24 px, traço 1,75 px, pontas e juntas arredondadas, sem preenchimento. Cor ativa `--im-giz`, inativa `--im-giz-3`. Exceção: **curtido** é preenchido e com traço em `--im-vermelho`. “mais” usa traço 3,2 px (pontos).
Conjunto (board **Icones**, exportar SVG de lá): inicio, galeria, novo-post, curtir, curtido, comentar, perfil, notificacao, copiar, fechar, voltar, mais, imagem, ok, alerta, trocar, lixo, escudo, apito.
Escudo do clube nos mockups é um placeholder verde; os escudos reais vêm do cadastro dos 20 clubes.

## Componentes e estados

**Botão** (altura 48, raio 10, largura total no celular, rótulo `botao` centralizado)
- primário: fundo `--im-vermelho`, texto giz. Pressionado: `--im-vermelho-press`. Desabilitado: opacidade 40% (texto 50%). Carregando: spinner 24 px (giz, arco de 90°) + rótulo no gerúndio (“Publicando…”), botão fica inerte.
- secundário: fundo `--im-superficie-alta`, texto giz.
- fantasma: sem fundo, borda 1 px `--im-linha`, texto giz.
- Foco de teclado (desktop): contorno 2 px `--im-giz`, deslocado 2 px.

**Campo de texto** (rótulo `legenda` medium giz-2 em cima, caixa 48 de altura, raio 10, padding horizontal 14, texto `corpo`)
- normal: fundo `--im-superficie`, borda 1 px `--im-linha`. Placeholder `--im-giz-3`.
- foco: borda 2 px `--im-giz`.
- erro: borda 2 px `--im-vermelho-texto` + ícone `alerta` 16 px + frase em `--im-vermelho-texto`, `legenda`, que diz o que fazer (“Esse e-mail parece incompleto. Confira o @ e o domínio.”).
- Para senha, o botão “mostrar” fica dentro do campo, alvo de 44 px.

**Avatar**: círculo de 32, 40, 64 ou 96 px. Com foto: `object-fit: cover`. Sem foto: fundo `--im-superficie-alta`, borda 1 px `--im-linha`, inicial do nome em Barlow Condensed 700 (tamanho ≈ 40% do avatar).

**Pílula do clube**: altura 24, raio total, fundo `--im-superficie-alta`, borda 1 px `--im-linha`, escudo 16 px à esquerda (padding 5) e sigla de 3 letras em Barlow Condensed 600, 14 px, +0,4 px. Aparece ao lado do nome da pessoa (comentários, perfil). Torcedor (sem clube): sem pílula, escrever “torcedor” em `legenda` giz-2.

**Card de post** (390 de largura, sem borda lateral, divisor de 1 px `--im-linha` embaixo)
- Cabeçalho (64): escudo 40 no círculo `--im-superficie-alta`, a 16 px da borda; nome do clube em `titulo-2` (20/24); “por Lincoln · há 2 horas” em `legenda` giz-2; ícone `mais` (24) à direita, só para o técnico do clube e o admin.
- Imagem: quadrada 390 × 390 (a versão do feed), fundo `--im-superficie-alta` enquanto carrega. Contador “1/3” no canto superior direito (pílula escura 72%, `micro`). Etiqueta “Ver prompt” no canto inferior esquerdo, só quando a imagem tem prompt (toque abre a galeria daquele item).
- Pontos do carrossel: 6 px, a 10 px da imagem, ativo giz, demais giz-3. Só aparece com mais de uma imagem.
- Ações: `curtir` e `comentar` (24 px, alvo 44) a 12 px da borda. Curtido: coração preenchido `--im-vermelho`, contagem “129 curtidas” sobe na hora (otimista).
- Contagem: `numero` (“128 curtidas”). Legenda: `corpo`, nome do técnico em `corpo-forte` antes do texto, corta em 3 linhas com “mais”. “Ver os 14 comentários” em `legenda` giz-2.
- Cada toque principal tem destino: clube → perfil do clube, imagem → carrossel, comentários → tela do post.

**Estados do feed**
- carregando: esqueleto com os mesmos blocos do card em `--im-superficie-alta`, pulsando (`--im-pulso`). Sem texto e sem spinner solto.
- erro: caixa `--im-superficie` com borda 1 px `--im-linha` e raio 12; ícone `alerta` em vermelho-texto; “Não deu para carregar o feed” (`titulo-2` 22); “Confira a conexão e tente de novo.”; botão secundário “Tentar de novo”.
- vazio: mesma caixa; ícone `imagem` giz-3; “Ainda não tem post por aqui”; “Quando alguém publicar, o post aparece aqui. Que tal abrir o jogo?”; botão primário “Novo post” (só para técnico de clube; torcedor vê só o texto).

## Desktop (a partir de 768 px)

Coluna do feed centralizada com no máximo 470 px de largura (imagem 470 × 470), fundo `--im-carvao`. Barra inferior do celular vira barra lateral esquerda de 72 px (só ícones; com ≥ 1100 px mostra rótulos, 220 px). Páginas de formulário (login, cadastro): cartão `--im-superficie` de 400 px, raio 12, centralizado. As telas de cada grupo trarão a versão desktop.

## Barra inferior (referência para o grupo de navegação)

Altura 56 + área segura do iPhone, fundo `--im-superficie`, borda superior 1 px `--im-linha`, 5 ícones (inicio, galeria, novo-post, notificacao, perfil), ativo `--im-giz`, inativo `--im-giz-3`. O desenho final fica no grupo de telas de navegação.

## Pendências para o Fabio aprovar

1. Direção, paleta, par de fontes e o selo com apito.
2. O vermelho fica só como acento (nunca em texto corrido).
3. Pílula do clube neutra (sem a cor do clube): o escudo já carrega a cor.
