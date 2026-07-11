# Colocar o TrafegoAI no ar

O TrafegoAI é full-stack (Postgres + Redis + API + worker + frontend). Há dois
caminhos para um **URL público**.

## Opção A — Render (um blueprint, tudo junto) — recomendado

1. Garanta que o repositório está no seu GitHub (já está, via PR #21).
2. Acesse https://dashboard.render.com/blueprints → **New Blueprint Instance**.
3. Escolha este repositório. O Render lê o `trafegoai/render.yaml` e provisiona:
   Postgres, Redis, `trafegoai-api` (roda migrations + seed automaticamente),
   `trafegoai-worker` e `trafegoai-web`.
4. Clique **Apply** e aguarde os builds.
5. **Passo manual (uma vez):** o frontend precisa saber a URL da API, que só
   existe após o 1º deploy. No serviço **trafegoai-web → Environment**, defina
   `NEXT_PUBLIC_API_URL = https://trafegoai-api.onrender.com` (use a URL real do
   seu serviço de API) e faça **Manual Deploy → Clear build cache & deploy**.
6. Abra a URL do serviço **trafegoai-web**. Login demo: `demo@trafegoai.com` / `demo1234`.

> Plano free hiberna após ociosidade (~30s no primeiro acesso). Para produção, use planos pagos.

## Opção B — Vercel (frontend) + Railway (API/worker/DB/Redis)

**Backend no Railway:**
1. https://railway.app → New Project → Deploy from GitHub → este repo.
2. Adicione os plugins **PostgreSQL** e **Redis** (Railway injeta `DATABASE_URL`/`REDIS_URL`).
3. Crie dois serviços a partir de `apps/api/Dockerfile`:
   - **api** — start: `sh -c "npx prisma migrate deploy && npm run seed:ifempty && node dist/src/main.js"`
   - **worker** — start: `node dist/src/jobs/worker.main.js`
4. Defina `JWT_SECRET` e `TOKEN_ENCRYPTION_KEY` (32 bytes). Exponha a porta da API.

**Frontend na Vercel:**
1. https://vercel.com → Import Project → este repo → root `trafegoai/apps/web`.
2. Env var `NEXT_PUBLIC_API_URL = https://<sua-api-no-railway>`.
3. Deploy. A Vercel dá o URL público do painel.

## Rodar localmente (sem nuvem)

```bash
cd trafegoai && docker compose up --build
# web http://localhost:3000 · api http://localhost:4000 · demo@trafegoai.com / demo1234
```

## Credenciais opcionais (ativam integrações reais)

Todas são opcionais — sem elas o app roda com o seed e IA em modo demo:
`ANTHROPIC_API_KEY` (IA), `GOOGLE_ADS_*`/`META_*`/`TIKTOK_*` (contas de anúncio),
`STRIPE_SECRET_KEY` + `STRIPE_PRICE_*` (checkout real). Veja `.env.example`.
