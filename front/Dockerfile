# Contexto de build = raiz do repo: docker build -f front/Dockerfile .
FROM node:24-alpine AS build
RUN corepack enable && corepack prepare pnpm@12.5.1 --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY front/package.json front/
COPY back/package.json back/
RUN pnpm install --frozen-lockfile --ignore-scripts --filter front...
COPY front front
# só o bundle: a checagem de tipos roda no CI
RUN pnpm --filter front exec vite build

FROM nginxinc/nginx-unprivileged:1.29-alpine
COPY front/nginx.conf /etc/nginx/conf.d/default.conf
COPY front/seguranca.conf /etc/nginx/snippets/seguranca.conf
COPY --from=build /app/front/dist /usr/share/nginx/html
HEALTHCHECK --interval=15s --timeout=3s --retries=5 CMD wget -qO- http://127.0.0.1:8080/ >/dev/null || exit 1
