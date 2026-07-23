# Publicar o TrafegoAI SEM backend (só o frontend) — o jeito mais fácil

Você não precisa de API, banco nem Redis para colocar o app no ar e navegar por
tudo. No **modo demonstração**, o frontend traz um "backend embutido no
navegador" (`apps/web/lib/mock.ts`) que responde a todas as telas com dados
realistas — dashboard, campanhas, Radar de Tendências, Planejador, recomendações,
relatórios, etc. É o mesmo modo que roda quando não há uma API real conectada.

O que funciona no modo demo: **navegar e demonstrar tudo** (gráficos, filtros,
drill-down, comparações, radar, gerador de criativos, planejador com IA
heurística, aplicar/desfazer recomendações — tudo em memória no navegador).
O que NÃO funciona (por design, precisa de backend real): salvar dados de
verdade, tempo real por WebSocket, integrações com Google/Meta/TikTok/YouTube e
cobrança Stripe.

## Opção 1 — Vercel (recomendada, ~2 min)

1. Acesse **https://vercel.com** → login com GitHub.
2. **Add New → Project** → importe `OFRANCISCOGENNIS/anonymousKS`.
3. Em **Root Directory**, escolha **`trafegoai/apps/web`**.
4. O `vercel.json` já define `NEXT_PUBLIC_DEMO_MODE=true` — não precisa mexer em
   env. (Se quiser conectar a um backend real depois, troque para
   `NEXT_PUBLIC_API_URL=https://sua-api`.)
5. **Deploy**. Ao final, a Vercel te dá a URL pública (ex.:
   `https://trafegoai.vercel.app`). Login: **demo@trafegoai.com / demo1234**
   (qualquer e-mail/senha entra no modo demo).

## Opção 2 — Netlify

1. **https://netlify.com** → Add new site → Import from GitHub → o repositório.
2. **Base directory:** `trafegoai/apps/web` · **Build:** `npm run build`.
3. Environment: `NEXT_PUBLIC_DEMO_MODE=true` (e o plugin oficial `@netlify/plugin-nextjs`, que a Netlify sugere sozinha).
4. Deploy → URL pública.

## Rodar o modo demo localmente

```bash
cd trafegoai/apps/web
npm install
NEXT_PUBLIC_DEMO_MODE=true npm run build && NEXT_PUBLIC_DEMO_MODE=true npm start
# abra http://localhost:3000  (nenhuma API/DB/Redis necessários)
```

## Quando quiser o backend real depois

Basta trocar a variável `NEXT_PUBLIC_DEMO_MODE` por
`NEXT_PUBLIC_API_URL=https://sua-api` (Railway/Render — ver `DEPLOY_RAILWAY.md` e
`DEPLOY.md`) e refazer o deploy. O mesmo frontend passa a falar com a API real,
com dados persistidos, tempo real e integrações.
