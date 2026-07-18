# Deploy do TrafegoAI no Railway (passo a passo)

O Railway sobe o full-stack facilmente porque cada serviço aponta para uma pasta
do monorepo e usa o Dockerfile dela. Ao final você tem um **URL público**.

## 1. Criar o projeto e os bancos

1. Acesse **https://railway.app** → login com GitHub.
2. **New Project → Deploy from GitHub repo** → escolha `OFRANCISCOGENNIS/anonymousKS`.
3. No projeto, clique **+ New** → **Database → Add PostgreSQL**. Repita para **Redis**.
   (O Railway injeta `DATABASE_URL` e `REDIS_URL` automaticamente nos serviços.)

## 2. Serviço da API (`trafegoai-api`)

No serviço criado a partir do repo (renomeie para `trafegoai-api` em Settings):

- **Settings → Root Directory:** `trafegoai/apps/api`
  (o Railway lê o `railway.json` de lá: build por Dockerfile + migrations + seed).
- **Variables** (aba Variables → RAW Editor):
  ```
  DATABASE_URL=${{Postgres.DATABASE_URL}}
  REDIS_URL=${{Redis.REDIS_URL}}
  JWT_SECRET=<gere um segredo forte>
  TOKEN_ENCRYPTION_KEY=<32 bytes em hex — ex.: openssl rand -hex 16 duas vezes>
  PORT=4000
  # opcionais:
  ANTHROPIC_API_KEY=
  YOUTUBE_API_KEY=
  STRIPE_SECRET_KEY=
  ```
  > `${{Postgres.DATABASE_URL}}` e `${{Redis.REDIS_URL}}` são referências do Railway —
  > digite exatamente assim que ele resolve para a URL real do banco.
- **Settings → Networking → Generate Domain** → anote a URL (ex.: `https://trafegoai-api.up.railway.app`).

## 3. Serviço do worker (`trafegoai-worker`)

- **+ New → GitHub Repo** → mesmo repo → renomeie para `trafegoai-worker`.
- **Root Directory:** `trafegoai/apps/api` (mesma imagem).
- **Settings → Deploy → Custom Start Command:** `node dist/src/jobs/worker.main.js`
  (sobrescreve o start do `railway.json`, que é o da API).
- **Variables:** as mesmas 4 essenciais (`DATABASE_URL`, `REDIS_URL`, `TOKEN_ENCRYPTION_KEY`) — pode copiar do serviço da API.
- Sem domínio público (é um worker de fila).

## 4. Frontend (`trafegoai-web`)

- **+ New → GitHub Repo** → mesmo repo → renomeie para `trafegoai-web`.
- **Root Directory:** `trafegoai/apps/web`.
- **Variables:**
  ```
  NEXT_PUBLIC_API_URL=https://trafegoai-api.up.railway.app   (a URL do passo 2)
  ```
- **Settings → Networking → Generate Domain** → esse é o **link do seu app**.
- Se você já tinha feito deploy do web antes de setar `NEXT_PUBLIC_API_URL`, clique
  **Deploy → Redeploy** (a variável é embutida em build time).

## 5. Usar

Abra a URL do `trafegoai-web`. Login demo: **demo@trafegoai.com / demo1234**.
O seed roda sozinho no 1º boot da API (agência com contas, campanhas, 90 dias de
métricas, radar, etc.).

## Alternativa: frontend na Vercel

Se preferir, o frontend fica ótimo na Vercel: **Import Project** → root
`trafegoai/apps/web` → env `NEXT_PUBLIC_API_URL` = URL da API no Railway → Deploy.

## Chave do YouTube (Radar de Vídeos em tempo real)

Depois de subir, cole sua `YOUTUBE_API_KEY` nas Variables do `trafegoai-api` e dê
restart. Como gerar (grátis): Google Cloud Console → ative "YouTube Data API v3"
→ Credenciais → Criar chave de API. **Nunca cole a chave em commits ou no chat.**
