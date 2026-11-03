# InstaManager — design da v1

Data: 2026-11-03 · Autor: Fabio (decisões) + Claude (calls marcadas)

## 1. O que é e por quê

Rede social interna, com cara de Instagram, para o grupo de amigos que joga **OSM (Online Soccer Manager)** numa liga do Brasileirão 2026. Hoje tudo acontece num grupo de WhatsApp: cada amigo é técnico de um clube e posta montagens feitas com IA (coletiva, apresentação de reforço, nota oficial, "novo técnico") com texto no tom de jornal esportivo. A galera reage e provoca.

O problema é que no WhatsApp tudo se perde: não fica a história do clube e os prompts que deram boas imagens somem. O app dá a esse conteúdo um lugar próprio: um **feed**, um **perfil por clube** com memória e uma **galeria de prompts**.

**Não há integração nenhuma com o OSM.** É só diversão entre amigos.

**Começa do zero:** nada é importado do WhatsApp, nem posts nem técnicos antigos. O histórico de técnicos começa no cadastro.

Prints do grupo atual: `Image (2..5).jpeg` na raiz do repo (fora do git: têm telefones).

## 2. Objetivos, não-objetivos e anti-objetivos

**Objetivos da v1**
- Feed estilo Instagram com posts livres (imagens + legenda).
- Perfil do clube, que guarda os posts e o histórico de técnicos.
- Galeria de prompts das imagens geradas com IA, com botão "copiar".
- Push no celular quando alguém posta.
- Instalável como PWA. Uso principal no celular, com muitos iPhones no grupo.

**Não-objetivos (ficam para a v1.1)**
Stories; mensagem direta; tabela, rodadas e resultados da liga; prêmios, votações e hall da fama; vídeo; busca; marcar pessoas com @. Gerar imagens ou textos com IA dentro do app também fica fora: a IA continua sendo usada fora (ChatGPT, Gemini etc.).

**Anti-objetivos (fracasso mesmo que funcione)**
- Ficar lento.
- Ser difícil de postar pelo celular.
- Ter muitos bugs.
- Ser complexo demais.

Qualquer funcionalidade que piore um desses pontos fica de fora.

## 3. Conceitos

- **Clube:** os 20 clubes da Série A do Brasileirão 2026, em lista fixa cadastrada no sistema (nome + escudo). Cada clube tem **um perfil**, que é dele e não da pessoa.
- **Usuário (técnico):** pessoa com conta (e-mail, senha, nome de exibição, foto). Fica ligada a **no máximo um clube** por vez e pode ficar sem clube.
- **Torcedor:** usuário sem clube. Vê, curte e comenta, mas não posta. Pode pedir para assumir um clube livre (§4.6).
- **Regra:** um técnico por clube. No máximo 20 técnicos ativos. Capacidade alvo: 30 usuários com folga.
- **Admin:** o Fabio. Aprova trocas de time e gera o código de convite.

## 4. Funcionalidades

### 4.1 Cadastro e login
- **Cadastro:** código de convite + e-mail + senha + nome de exibição + escolha de um clube **livre** (só aparecem os clubes sem técnico) **ou "torcedor"** (sem clube). Foto de perfil é opcional.
- **Código de convite:** um único código do grupo, que o Fabio manda no WhatsApp. O admin pode trocar o código. *(Minha call: código único e reutilizável, sem convite individual.)*
- **Login:** só e-mail + senha. Sem Google.
- **Recuperação de senha:** link por e-mail via **Resend**, no domínio fj-dev.tech, que já foi usado no Terrato.
- *(Minha call:)* sem confirmação de e-mail no cadastro, porque o código de convite já impede estranhos.
- Se o clube for escolhido por outra pessoa no meio do cadastro, aparece um erro claro e a pessoa escolhe outro.

### 4.2 Post
- Uma ou mais imagens (*minha call: até 10*), legenda livre e, para cada imagem, um **prompt opcional**.
- Não existe "tipo" de post: é tudo livre.
- O post pertence ao **clube** e registra **quem era o técnico** que publicou, exibido como "por Lincoln".
- As imagens são comprimidas e redimensionadas **no celular antes do envio** para o post ser rápido. O servidor também gera uma versão menor para o feed.
- Quem edita a legenda e o prompt e apaga o post é o **técnico atual do clube**, porque o perfil é do clube. O ex-técnico perde esse poder quando sai. O admin pode apagar qualquer post. *(Minha call, segue "perfil é do clube, só troca quem administra".)*
- O fluxo de postar no celular deve caber em poucos toques: escolher imagens → legenda (+ prompts) → publicar.

### 4.3 Feed
- Lista em ordem cronológica, do mais novo para o mais velho, com rolagem infinita.
- Cada post mostra escudo e nome do clube, "por <técnico>", imagens em carrossel, legenda, curtidas e comentários.
- **Curtida** de um toque, sem tipos de reação. *(Minha call: estilo Instagram, como pedido.)*
- **Comentários** simples, sem resposta encadeada. Cada comentário mostra o nome da pessoa e a tag do clube atual dela. O autor apaga o próprio comentário e o admin apaga qualquer um.

### 4.4 Perfil do clube
- Escudo, nome, técnico atual e grade de posts do clube.
- **Histórico de técnicos:** quem passou pelo clube, com data de entrada e de saída.
- Os posts ficam no perfil mesmo depois que o técnico sai.
- Só o técnico atual posta pelo clube.

### 4.5 Perfil da pessoa
- Página simples: nome, foto e clube atual. Dá para editar nome, foto e senha. *(Minha call: mínimo necessário.)*

### 4.6 Troca de time
- O técnico abre uma **solicitação**, que pode ser "sair do clube" ou "assumir o clube X". O clube X precisa estar livre.
- O admin vê as solicitações pendentes numa tela e **aprova ou recusa**.
- Ao aprovar, o histórico do clube antigo ganha a data de saída e o do clube novo ganha a entrada. Os posts antigos continuam no clube antigo.
- Quem estiver sem clube consegue ver, curtir e comentar, mas não posta.
- *(Minha call:)* o pedido é avisado ao admin por push e o resultado é avisado ao técnico por push.

### 4.7 Galeria de prompts
- Grade com todas as imagens que têm prompt preenchido.
- Ao tocar numa imagem: imagem grande, prompt, botão **"copiar prompt"** e link para o post de origem.
- Filtro por clube. *(O filtro por "tipo" saiu junto com os tipos de post.)*

### 4.8 Notificações push
- Push para todos (menos o autor) quando sai um **post novo**.
- Push também quando alguém **comenta num post do clube**. Quem recebe é o técnico atual do clube, exceto quando ele mesmo comentou.
- Web Push padrão (VAPID), sem serviço pago.
- **iPhone:** o push só funciona com o PWA instalado na tela inicial (iOS 16.4+). Depois do primeiro login, uma tela ensina a instalar (Compartilhar → "Adicionar à Tela de Início") e então pede permissão de notificação.
- A pessoa pode desligar o push no próprio perfil.

### 4.9 Admin
- Fica dentro do app, visível só para o admin: solicitações de troca, código de convite, apagar post ou comentário e tirar um técnico de um clube.
- O admin pode ser técnico de um clube também.

## 5. Restrições e decisões técnicas

| Item | Decisão |
|---|---|
| Front | React + Vite + TypeScript, PWA (service worker, manifest) *(minha call)* |
| Back | Nest + PostgreSQL *(minha call, segue o Terrato)* |
| Imagens | Disco da VPS (volume Docker), servidas pelo nginx do container web *(minha call)* |
| Proxy/HTTPS | Traefik que já existe na VPS (rede externa `infra-network`, certresolver `letsencrypt`), por labels no serviço web, igual ao `docker-compose.prod.yml` do Terrato |
| E-mail | Resend (recuperação de senha) |
| Push | Web Push / VAPID |
| Hospedagem | Docker na VPS Hostinger, subdomínio de fj-dev.tech (ex.: `instamanager.fj-dev.tech`) |
| Backup | Entra no script de backup que já existe na VPS (`~/projetos/infra/backup/backup.sh`), com dump do banco + pasta de imagens. Mexer na VPS só com confirmação. |
| Segredos | Só em `.env` |
| Testes | Toda lógica nova com teste |
| Carga | 30 usuários. Não precisa escalar além disso. |

**Desempenho, porque "lento" é anti-objetivo:** o feed abre rápido no 4G, as imagens são servidas em tamanho de feed com lazy load e o post é enviado já comprimido.

## 6. Forma de trabalho

Mesmo fluxo do Terrato no Maestri: Claude como Maestro e agentes P.O, Designer, Front, Back, Revisor e QA, com quadro de tarefas e portões. As paradas acontecem em design de tela, dependência nova, push, VPS e mudança de spec. O design das telas vem primeiro no Penpot.

## 7. Fica a critério do builder

- Modelagem exata do banco e contrato da API.
- Biblioteca de compressão de imagem no cliente, formato de saída (ex.: WebP) e tamanhos.
- Estratégia de sessão (cookie, como no Terrato, é a sugestão).
- Identidade visual: será definida na etapa de design no Penpot. Referência: cara de Instagram, tema escuro como os prints.
- Paginação do feed e da galeria.
- Escudos dos 20 clubes: o builder busca em fonte pública (ex.: SVGs da Wikipédia) e o Fabio confere. *(Minha call; uso privado entre amigos.)*
