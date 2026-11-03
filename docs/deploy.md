# Deploy do InstaManager (VPS Hostinger)

Passo a passo do que o Fabio faz. O repo já traz o que é automático: `back/Dockerfile`, `front/Dockerfile`, `docker-compose.prod.yml`, `.github/workflows/deploy.yml` (verificar + implantar por SSH) e `saude.yml` (confere `/api/health` a cada 10 min).

Desenho: o Traefik que já roda na VPS (rede externa `infra-network`, certresolver `letsencrypt`) fala com o container `web` (nginx, porta 8080), que serve o front e as fotos (`/uploads`, volume `uploads` só leitura) e repassa `/api` ao `back`. O `back` e o Postgres 17 ficam só na rede interna. No boot, o `back` roda `prisma migrate deploy` e o seed (20 clubes + código de convite inicial); os dois são idempotentes.

## 1. Repo no GitHub (privado)

```bash
gh repo create instamanager --private --source . --remote origin   # ou crie no site e use git remote add
git push -u origin main                                            # o push é seu; nada aqui faz push
```

Em **Settings → Secrets and variables → Actions**, crie `VPS_HOST`, `VPS_USER` e `VPS_SSH_KEY` (a chave privada do usuário de deploy, a mesma ideia do Terrato).

## 2. DNS

Aponte `instamanager.fj-dev.tech` (registro A) para o IP da VPS. O certificado sai sozinho pelo Traefik no primeiro acesso.

## 3. Chaves e senhas (na sua máquina)

```bash
pnpm install
pnpm --filter back exec web-push generate-vapid-keys   # VAPID_PUBLIC_KEY e VAPID_PRIVATE_KEY
openssl rand -base64 24                                # POSTGRES_PASSWORD
```

- **Resend:** crie a chave (`RESEND_API_KEY`) e use um remetente de domínio já verificado, ex. `InstaManager <nao-responda@fj-dev.tech>`. Sem chave, a recuperação de senha não envia e-mail.
- **Não troque o par VAPID depois**: todas as inscrições de push existentes deixam de valer.

## 4. Clonar e configurar na VPS

```bash
ssh <usuario>@<vps>
git clone git@github.com:<voce>/instamanager.git ~/projetos/instamanager   # precisa de deploy key ou gh auth
cd ~/projetos/instamanager
nano .env      # nunca vai para o repo
```

`.env` da VPS:

```
POSTGRES_USER=instamanager
POSTGRES_PASSWORD=<a senha gerada>
POSTGRES_DB=instamanager
APP_URL=https://instamanager.fj-dev.tech      # igual ao que o navegador mostra, sem barra no fim (confere o Origin)
INVITE_CODE=<o código que vai no WhatsApp>   # só vale na 1ª vez; depois o admin troca pelo app
ADMIN_EMAIL=<seu e-mail>                      # a conta com este e-mail vira admin ao se cadastrar
RESEND_API_KEY=<chave>
MAIL_FROM=InstaManager <nao-responda@fj-dev.tech>
VAPID_PUBLIC_KEY=<do passo 3>
VAPID_PRIVATE_KEY=<do passo 3>
VAPID_SUBJECT=mailto:<seu e-mail>
```

O compose recusa subir sem `POSTGRES_*`, `APP_URL`, `INVITE_CODE` e `ADMIN_EMAIL`. `TRUST_PROXY=1`, `UPLOADS_DIR` e `HOST` já vêm fixados no `docker-compose.prod.yml`.

## 5. Primeiro deploy

```bash
docker compose -f docker-compose.prod.yml --env-file .env up -d --build
docker compose -f docker-compose.prod.yml ps          # db, back e web "healthy"
docker compose -f docker-compose.prod.yml logs back   # migrations aplicadas, sem erro
curl -fsS https://instamanager.fj-dev.tech/api/health # {"status":"ok"}
```

Depois disso, todo `git push` na `main` com o CI verde implanta sozinho (job `implantar`).

## 6. Cadastrar a conta admin PRIMEIRO

O admin é definido pelo e-mail: quem se cadastra com o `ADMIN_EMAIL` vira admin, e quem tiver o código de convite pode usar qualquer e-mail. Então, **antes de mandar o convite para o grupo**:

1. Abra `https://instamanager.fj-dev.tech`, cadastre-se com o código de convite e o `ADMIN_EMAIL` (escolha seu clube ou "torcedor").
2. Confirme na tela de admin que ela aparece.
3. Só então mande o código no WhatsApp.

Se alguém tomar o e-mail antes (improvável), troque o `ADMIN_EMAIL` ou promova a conta: `docker compose -f docker-compose.prod.yml exec db psql -U instamanager -c "update \"User\" set \"isAdmin\" = true where email = '<seu e-mail>'"`.

## 7. Backup (banco + fotos)

Edite o `backup.sh` que já existe na VPS (`~/projetos/infra/backup/backup.sh`) seguindo o jeito dele (destino, rotação). Duas linhas novas, com `$DEST` e `$DATA` no estilo do script:

```bash
cd ~/projetos/instamanager
# banco
docker compose -f docker-compose.prod.yml --env-file .env exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' | gzip > "$DEST/instamanager-db-$DATA.sql.gz"
# fotos (volume uploads; confira o nome com: docker volume ls | grep uploads, normalmente instamanager_uploads)
docker run --rm -v instamanager_uploads:/v:ro -v "$DEST":/b alpine tar czf "/b/instamanager-uploads-$DATA.tar.gz" -C /v .
```

Teste uma vez à mão e **restaure num lugar de teste** antes de confiar:

```bash
gunzip -c instamanager-db-<data>.sql.gz | docker compose -f docker-compose.prod.yml exec -T db psql -U instamanager instamanager
docker run --rm -v instamanager_uploads:/v -v "$PWD":/b alpine tar xzf /b/instamanager-uploads-<data>.tar.gz -C /v
```

## 8. Dia a dia

- **Logs:** `docker compose -f docker-compose.prod.yml logs -f back` (rotação: 3 × 10 MB por serviço).
- **Trocar o código de convite:** pelo app (tela de admin). O `INVITE_CODE` do `.env` só vale na primeira subida.
- **Voltar uma versão:** `git checkout <commit>` na VPS e o mesmo `up -d --build`. Migrations só andam para frente; mudanças de schema precisam de migration nova.
- **Saúde:** se o `saude.yml` falhar, o GitHub avisa por e-mail. O GitHub desliga cron depois de 60 dias sem atividade no repo.
- **iPhone:** o push só funciona com o app instalado na tela inicial (iOS 16.4+); o app ensina o passo a passo depois do primeiro login.
