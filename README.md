# instamanager

Monorepo pnpm: `front/` (React + Vite) e `back/` (Nest 12 + Prisma 7). Banco: PostgreSQL 17 no Docker (porta 5433). Produto: `docs/superpowers/specs/`; fluxo dos agentes: `docs/fluxo.md`.

## Requisitos

Node 24+, pnpm, Docker com Compose.

## Subir

```bash
cp .env.example .env              # troque a senha nas duas linhas
pnpm install
docker compose up -d              # Postgres em 127.0.0.1:5433
pnpm --filter back db:deploy      # aplica as migrações
pnpm --filter back start:dev      # http://localhost:3000/api/health
pnpm --filter front dev           # http://localhost:5173
```

## Testes

```bash
pnpm test                         # front + back unit + back e2e
node --test board/board.test.mjs  # quadro de tarefas
```
