# Contexto de build = raiz do repo (workspace pnpm): docker build -f back/Dockerfile .
FROM node:24-alpine AS build
# mesma versão do CI (o repo não fixa packageManager)
RUN corepack enable && corepack prepare pnpm@12.5.1 --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY back/package.json back/
COPY front/package.json front/
COPY back/prisma back/prisma
COPY back/prisma.config.ts back/
# --store-dir: o pnpm-workspace.yaml aponta para o disco do Fabio, que não existe aqui
RUN pnpm install --frozen-lockfile --store-dir /pnpm-store --filter back...
COPY back back
RUN pnpm --filter back build

FROM node:24-alpine
WORKDIR /app/back
ENV NODE_ENV=production \
    UPLOADS_DIR=/var/uploads
COPY --from=build /app /app
# o volume 'uploads' herda este dono na primeira vez que é montado (o back roda como node)
RUN mkdir -p /var/uploads && chown node:node /var/uploads
# migrations e seed (clubes + código de convite inicial) rodam antes de subir; os dois são idempotentes
CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy && node --import ./prisma/resolver.mjs prisma/seed.ts && node dist/main"]
HEALTHCHECK --interval=15s --timeout=3s --start-period=30s --retries=5 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1
USER node
