# Fluxo de desenvolvimento do InstaManager (agentes no Maestri)

Este fluxo copia o do Terrato.

**Fontes da verdade**
- Produto: `docs/superpowers/specs/2026-11-03-instamanager-design.md`.
- Plano: `docs/superpowers/plans/2026-11-03-instamanager-v1.md`.
- Tarefas: `board/tasks.json`.

**Ver o quadro:** rode `cd board && python3 -m http.server --bind 127.0.0.1 8766` e abra http://localhost:8766.

## Equipe

O Maestro é o terminal **Claude**.

| Agente | Papel | Modelo | Faz | Não faz |
|---|---|---|---|---|
| Claude | Maestro | Opus | Distribui tarefas, confere entregas, faz o merge na `main` e para nos portões do Fabio | Escrever código de produto |
| Súmula | P.O | Haiku | Quebra o plano em cards com critérios de pronto. **Único que escreve no quadro** | Implementar ou decidir arquitetura |
| Prancheta | Designer | Sonnet | Único com o Penpot MCP. Desenha as telas e escreve o handoff em `docs/design/` | Código de produto |
| Volante | Back | Sonnet | Nest + Prisma + Postgres, segue `docs/api.md`, sempre com teste | Campo ou endpoint fora do contrato |
| Ponta | Front | Sonnet | React + Vite PWA, segue o handoff à risca, sempre com teste | Inventar cor, fonte ou espaçamento |
| VAR | Revisor | Opus | Lê o diff com olhar novo e lista achados priorizados | Editar código |
| Bandeirinha | QA | Sonnet | Roda os testes e usa o app no portal em tamanho de celular. Reprova com os passos para reproduzir | Editar código |

## Trilhas (dono dos arquivos)

| Trilha | Agente | Dono de |
|---|---|---|
| Back | Volante | `back/**` |
| Front | Ponta | `front/**` |
| Design | Prancheta | Penpot e `docs/design/**` |
| Maestro/Infra | Claude | `board/**`, `docs/fluxo.md`, `.github/**`, `docker-compose*.yml` |

Quem precisar mexer em arquivo de outra trilha pede ao Maestro.

## Colunas e transições

```
backlog → pronto → dev → revisao → qa → concluido
                    ↑        │       │
                    └─ correcao ◄────┘   (Revisor ou QA reprovou; nota obrigatória)
```

## Ciclo de uma tarefa

1. A **P.O** cria o card (`add`) e o move para `pronto` quando os critérios estão claros. Se for tela, o design precisa estar aprovado pelo Fabio.
2. O **Maestro** escolhe o responsável e a P.O registra (`assign`) e move o card para `dev`.
3. O **dev** trabalha no próprio andar ou branch (`feat/IM-N-curto`), com teste. Ao terminar, avisa o Maestro.
4. O **Maestro** confere, pede à P.O que mova o card para `revisao` e aciona o **Revisor**.
5. Se o Revisor aprova, o card vai para `qa`. Se reprova, vai para `correcao` e volta ao mesmo dev.
6. O **QA** testa só tarefas com tela. Se aprova, o card vai para `concluido` e o Maestro faz o merge na `main`. Tarefa sem tela fecha com revisão + testes.

## Portões do Fabio (o fluxo para e espera)

- Design de cada grupo de telas.
- Dependência nova.
- `git push`.
- Qualquer ação na VPS.
- Mudança no spec.

O resto anda sozinho.

## Comunicação e custo

- Rode `maestri list` antes de pedir algo a alguém.
- Ao terminar, responda com `maestri ask "Claude" "<resultado>"`, em no máximo 8 linhas.
- Quadro: `node board/board.mjs`. Só a P.O usa `add/move/assign/edit/comment`.
- Commits em Conventional Commits, com o ID do card: `feat(posts): feed por cursor [IM-5]`.
- No máximo 1 ou 2 devs ao mesmo tempo. O QA só entra quando houver tela.
- Andar mergeado é apagado. Portal e Vite fecham no fim do QA.
- Nada de `node_modules` no `/tmp`, porque ele usa memória RAM.
- Antes de abrir arquivo inteiro, consulte o code-review-graph.
- O `nginx.conf` sempre passa por `nginx -t` num container antes de ir para a `main` (lição do Terrato).
