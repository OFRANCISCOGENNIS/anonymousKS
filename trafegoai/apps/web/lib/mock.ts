/**
 * MODO DEMONSTRAÇÃO — "backend no navegador".
 *
 * Quando NEXT_PUBLIC_DEMO_MODE === 'true' (ou quando a API real está
 * inacessível), o cliente HTTP (lib/api.ts) roteia as chamadas para cá em vez
 * de fazer fetch na rede. Assim o app roda inteiro no front, sem API/DB/Redis —
 * ideal para publicar só o frontend (Vercel/Netlify/GitHub Pages) com um link
 * público. Os dados espelham o seed do backend; ações (pausar, aplicar
 * recomendação, etc.) mutam um estado em memória para a UI parecer viva.
 */

export const DEMO_MODE =
  process.env.NEXT_PUBLIC_DEMO_MODE === 'true' || !process.env.NEXT_PUBLIC_API_URL;

// ---------- utilidades ----------
function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const round = (v: number, d = 2) => { const f = 10 ** d; return Math.round(v * f) / f; };
function derive(t: { spend: number; revenue: number; impressions: number; clicks: number; conversions: number }) {
  const safe = (n: number, d: number) => (d > 0 ? n / d : 0);
  return {
    ...t,
    roas: round(safe(t.revenue, t.spend)),
    roi: round(safe(t.revenue - t.spend, t.spend) * 100, 1),
    cpa: round(safe(t.spend, t.conversions)),
    cpc: round(safe(t.spend, t.clicks)),
    cpm: round(safe(t.spend, t.impressions) * 1000),
    ctr: round(safe(t.clicks, t.impressions) * 100),
    convRate: round(safe(t.conversions, t.clicks) * 100),
  };
}
const empty = () => ({ spend: 0, revenue: 0, impressions: 0, clicks: 0, conversions: 0 });
function add(acc: any, r: any) { acc.spend += +r.spend; acc.revenue += +r.revenue; acc.impressions += r.impressions; acc.clicks += r.clicks; acc.conversions += r.conversions; }
const pctChange = (c: number, p: number) => (p === 0 ? null : round(((c - p) / p) * 100, 1));

const DAYS = 90;
const today = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; })();

// ---------- dataset base ----------
interface Spec { name: string; platform: string; account: string; client: string; objective: string; budget: number; baseSpend: number; roas: number; cvr: number; ctr: number; trend: number; status?: string }
const SPECS: Spec[] = [
  { name: '[Search] Marca — Vitta', platform: 'GOOGLE', account: 'Google Ads — Loja Vitta', client: 'Loja Vitta', objective: 'SALES', budget: 150, baseSpend: 120, roas: 6.2, cvr: 0.062, ctr: 0.071, trend: 0.001 },
  { name: '[PMax] Catálogo Completo', platform: 'GOOGLE', account: 'Google Ads — Loja Vitta', client: 'Loja Vitta', objective: 'SALES', budget: 400, baseSpend: 350, roas: 3.4, cvr: 0.031, ctr: 0.019, trend: 0.002 },
  { name: '[Search] Genéricas — Suplementos', platform: 'GOOGLE', account: 'Google Ads — Loja Vitta', client: 'Loja Vitta', objective: 'SALES', budget: 250, baseSpend: 220, roas: 1.1, cvr: 0.012, ctr: 0.028, trend: -0.003 },
  { name: '[Search] Implante Dentário — POA', platform: 'GOOGLE', account: 'Google Ads — Clínica Sorriso', client: 'Clínica Sorriso', objective: 'LEADS', budget: 200, baseSpend: 180, roas: 4.8, cvr: 0.055, ctr: 0.064, trend: 0.001 },
  { name: '[CBO] Escala — Criativos Vencedores', platform: 'META', account: 'Meta Ads — Loja Vitta', client: 'Loja Vitta', objective: 'CONVERSIONS', budget: 500, baseSpend: 470, roas: 4.1, cvr: 0.029, ctr: 0.021, trend: -0.004 },
  { name: '[Remarketing] Carrinho Abandonado', platform: 'META', account: 'Meta Ads — Loja Vitta', client: 'Loja Vitta', objective: 'CONVERSIONS', budget: 100, baseSpend: 90, roas: 7.8, cvr: 0.081, ctr: 0.035, trend: 0.001 },
  { name: '[Leads] Matrícula Julho — Feed+Reels', platform: 'META', account: 'Meta Ads — Academia Forte', client: 'Academia Forte', objective: 'LEADS', budget: 120, baseSpend: 105, roas: 3.0, cvr: 0.042, ctr: 0.024, trend: 0.002 },
  { name: '[Alcance] Institucional Bairro', platform: 'META', account: 'Meta Ads — Academia Forte', client: 'Academia Forte', objective: 'AWARENESS', budget: 40, baseSpend: 35, roas: 0.4, cvr: 0.002, ctr: 0.008, trend: -0.001, status: 'PAUSED' },
  { name: '[Spark] UGC Creatina — Influencers', platform: 'TIKTOK', account: 'TikTok Ads — Loja Vitta', client: 'Loja Vitta', objective: 'CONVERSIONS', budget: 200, baseSpend: 175, roas: 3.7, cvr: 0.022, ctr: 0.014, trend: 0.004 },
  { name: '[VSA] Top View Lançamento', platform: 'TIKTOK', account: 'TikTok Ads — Loja Vitta', client: 'Loja Vitta', objective: 'TRAFFIC', budget: 90, baseSpend: 80, roas: 0.9, cvr: 0.006, ctr: 0.011, trend: -0.002 },
  { name: '[Leads] Desafio 30 dias', platform: 'TIKTOK', account: 'TikTok Ads — Academia Forte', client: 'Academia Forte', objective: 'LEADS', budget: 80, baseSpend: 70, roas: 2.6, cvr: 0.033, ctr: 0.018, trend: 0.003 },
];

interface Camp { id: string; spec: Spec; status: string; budget: number; daily: any[]; ads: any[]; adSets: any[] }

function build() {
  const rand = rng(42);
  const camps: Camp[] = [];
  SPECS.forEach((spec, ci) => {
    const id = `c${ci + 1}`;
    const daily: any[] = [];
    const SHARE = [0.34, 0.18, 0.28, 0.20], RV = [1.28, 0.82, 1.06, 0.72], CV = [1.18, 0.78, 1.02, 0.74];
    const ads: any[] = [];
    const adSets = [
      { id: `${id}-s1`, name: 'Público Frio — Interesses', status: 'ACTIVE', targeting: { idade: '25-45', genero: 'todos', local: 'Brasil', interesses: ['fitness', 'saúde'] }, adIdx: [0, 1] },
      { id: `${id}-s2`, name: 'Lookalike 1% Compradores', status: 'ACTIVE', targeting: { idade: '25-45', genero: 'todos', local: 'Brasil', interesses: ['lookalike'] }, adIdx: [2, 3] },
    ];
    // acumuladores por anúncio
    const adTotals = [empty(), empty(), empty(), empty()];
    const adCtrEarly = [0, 0, 0, 0], adCtrLate = [0, 0, 0, 0], adFreq = [0, 0, 0, 0];
    for (let d = DAYS - 1; d >= 0; d--) {
      const date = new Date(today.getTime() - d * 86400000);
      const drift = 1 + spec.trend * (DAYS - d);
      const wf = date.getUTCDay() === 0 || date.getUTCDay() === 6 ? 0.75 : 1;
      const spend = spec.baseSpend * drift * wf * (0.8 + rand() * 0.4);
      const ctrNow = spec.ctr * (spec.trend < 0 ? 1 + spec.trend * (DAYS - d) * 1.5 : 1) * (0.9 + rand() * 0.2);
      const clicks = Math.max(1, Math.round(spend / (0.6 + rand() * 1.8)));
      const impressions = Math.round(clicks / Math.max(ctrNow, 0.001));
      const conversions = Math.round(clicks * spec.cvr * (0.85 + rand() * 0.3));
      const revenue = spend * spec.roas * (0.85 + rand() * 0.3) * drift;
      const row = { date: date.toISOString().slice(0, 10), spend: round(spend), revenue: round(revenue), impressions, clicks, conversions, frequency: round(1.4 + (spec.trend < 0 ? (DAYS - d) * 0.025 : 0) + rand() * 0.4) };
      daily.push(row);
      // por anúncio
      for (let a = 0; a < 4; a++) {
        const fatigue = (a === 1 || a === 3) && spec.trend < 0;
        const aSpend = spend * SHARE[a] * (0.9 + rand() * 0.2);
        const fctr = fatigue ? 1 - 0.006 * (DAYS - d) : 1;
        const aCtr = Math.max(ctrNow * CV[a] * fctr, 0.001);
        const aClicks = Math.max(1, Math.round(aSpend / (0.6 + rand() * 1.8)));
        const aImpr = Math.round(aClicks / aCtr);
        const aConv = Math.round(aClicks * spec.cvr * RV[a] * (0.85 + rand() * 0.3));
        const aRev = aSpend * spec.roas * RV[a] * (0.85 + rand() * 0.3) * drift;
        add(adTotals[a], { spend: aSpend, revenue: aRev, impressions: aImpr, clicks: aClicks, conversions: aConv });
        if (d >= DAYS / 2) adCtrEarly[a] += aClicks / Math.max(aImpr, 1); else adCtrLate[a] += aClicks / Math.max(aImpr, 1);
        adFreq[a] = round(1.4 + (fatigue ? (DAYS - d) * 0.03 : 0) + rand() * 0.4);
      }
    }
    for (let a = 0; a < 4; a++) {
      const early = adCtrEarly[a] / (DAYS / 2) * 100, late = adCtrLate[a] / (DAYS / 2) * 100;
      const ctrDrop = early > 0 ? round(((early - late) / early) * 100, 1) : 0;
      ads.push({
        id: `${id}-a${a}`, name: `AD ${a < 2 ? 1 : 2}.${(a % 2) + 1} — ${a % 2 === 0 ? 'Imagem estática' : 'Vídeo UGC'}`,
        totals: adTotals[a],
        creative: { headline: a % 2 === 0 ? `Oferta ${spec.name.slice(0, 22)}` : 'Prova social — depoimento real' },
        fatigue: { fatigued: ctrDrop > 22 && adFreq[a] > 2.5, ctrDrop, freq: adFreq[a] },
      });
    }
    camps.push({ id, spec, status: spec.status ?? 'ACTIVE', budget: spec.budget, daily, ads, adSets });
  });
  return camps;
}

const CAMPS = build();

// ---------- estado mutável (ações da UI) ----------
const state = {
  plan: 'AGENCY',
  campStatus: Object.fromEntries(CAMPS.map((c) => [c.id, c.status])) as Record<string, string>,
  campBudget: Object.fromEntries(CAMPS.map((c) => [c.id, c.budget])) as Record<string, number>,
  targeting: {} as Record<string, any>,
  recStatus: {} as Record<string, string>,
  chat: [] as any[],
};

// ---------- agregadores ----------
function sliceDays(preset?: string) {
  const n = preset === 'today' ? 1 : preset === '7d' ? 7 : 30;
  return n;
}
function campMatch(f: any, c: Camp) {
  if (f.platform && c.spec.platform !== f.platform) return false;
  if (f.clientId && f.clientId !== clientId(c.spec.client)) return false;
  return true;
}
const clientId = (name: string) => ({ 'Loja Vitta': 'cl1', 'Clínica Sorriso': 'cl2', 'Academia Forte': 'cl3' } as any)[name];

function totalsFor(f: any, n: number) {
  const t = empty();
  for (const c of CAMPS) {
    if (!campMatch(f, c)) continue;
    c.daily.slice(-n).forEach((r) => add(t, r));
  }
  return t;
}

// ---------- roteador ----------
function parse(path: string): { p: string; q: Record<string, string> } {
  const [p, qs] = path.split('?');
  const q: Record<string, string> = {};
  if (qs) new URLSearchParams(qs).forEach((v, k) => (q[k] = v));
  return { p, q };
}

export async function mockRequest<T>(method: string, path: string, body?: any): Promise<T> {
  const { p, q } = parse(path);
  const R = (x: any) => x as T;

  // auth
  if (p === '/auth/login' || p === '/auth/register') return R({ accessToken: 'demo-token' });
  if (p === '/auth/me') return R({ user: { id: 'u1', email: 'demo@trafegoai.com', name: 'Gestor Demo' }, org: { id: 'org1', name: 'Agência Demo Performance', plan: state.plan, brandColor: '#6366f1' }, role: 'ADMIN' });

  // dashboard
  if (p === '/dashboard/summary') {
    const n = sliceDays(q.preset);
    const raw = totalsFor(q, n);
    const cur = derive(raw);
    // período anterior: fatores por métrica diferentes → razões (ROAS/CPA…) também variam
    const prev = derive({ spend: raw.spend * 0.97, revenue: raw.revenue * 0.91, impressions: raw.impressions * 0.95, clicks: raw.clicks * 0.98, conversions: raw.conversions * 0.9 });
    const change: any = {};
    for (const k of Object.keys(cur)) change[k] = pctChange((cur as any)[k], (prev as any)[k]);
    return R({ period: {}, totals: cur, previous: prev, change });
  }
  if (p === '/dashboard/timeseries') {
    const n = sliceDays(q.preset);
    const byDay = new Map<string, any>();
    for (const c of CAMPS) { if (!campMatch(q, c)) continue; c.daily.slice(-n).forEach((r) => { if (!byDay.has(r.date)) byDay.set(r.date, empty()); add(byDay.get(r.date), r); }); }
    return R([...byDay.entries()].map(([date, t]) => ({ date, ...derive(t) })));
  }
  if (p === '/dashboard/funnel') {
    const t = totalsFor(q, sliceDays(q.preset));
    return R([{ stage: 'Impressões', value: t.impressions }, { stage: 'Cliques', value: t.clicks }, { stage: 'Conversões', value: t.conversions }]);
  }
  if (p === '/dashboard/platform-split') {
    const n = sliceDays(q.preset);
    const byP = new Map<string, any>();
    for (const c of CAMPS) { if (!campMatch(q, c)) continue; if (!byP.has(c.spec.platform)) byP.set(c.spec.platform, empty()); c.daily.slice(-n).forEach((r) => add(byP.get(c.spec.platform), r)); }
    return R([...byP.entries()].map(([platform, t]) => ({ platform, ...derive(t) })));
  }
  if (p === '/dashboard/heatmap') {
    const rand = rng(7); const cells: any[] = [];
    for (let dow = 0; dow < 7; dow++) for (let h = 0; h < 24; h++) {
      const peak = Math.exp(-((h - 20) ** 2) / 18) + 0.6 * Math.exp(-((h - 12) ** 2) / 10);
      const base = (dow >= 1 && dow <= 5 ? 1 : 0.7) * (0.15 + peak);
      const conversions = Math.round(base * 12 * (0.7 + rand() * 0.6));
      const spend = round(base * 90 * (0.8 + rand() * 0.4));
      cells.push({ dayOfWeek: dow, hour: h, spend, conversions, revenue: round(base * 320), cpa: conversions ? round(spend / conversions) : null });
    }
    return R(cells);
  }
  if (p === '/dashboard/highlights') {
    const n = sliceDays(q.preset);
    const stats = CAMPS.filter((c) => campMatch(q, c)).map((c) => { const t = empty(); c.daily.slice(-n).forEach((r) => add(t, r)); return { id: c.id, name: c.spec.name, platform: c.spec.platform, ...derive(t) }; }).filter((s) => s.spend > 50);
    if (!stats.length) return R({ best: null, worst: null, waste: null, opportunity: null });
    const best = [...stats].sort((a, b) => b.roas - a.roas)[0];
    const worst = [...stats].sort((a, b) => a.roas - b.roas)[0];
    const waste = [...stats].sort((a, b) => (b.spend - b.revenue) - (a.spend - a.revenue))[0];
    const opp = [...stats].filter((s) => s.roas >= 3).sort((a, b) => b.roas * b.spend - a.roas * a.spend)[0] ?? best;
    return R({ best, worst, waste: { ...waste, wasted: round(Math.max(waste.spend - waste.revenue, 0)) }, opportunity: { ...opp, hint: 'ROAS alto e estável — candidata a escala gradual de verba' } });
  }

  // campaigns
  if (p === '/campaigns' && method === 'GET') {
    const n = sliceDays(q.preset);
    return R(CAMPS.filter((c) => campMatch(q, c)).filter((c) => !q.search || c.spec.name.toLowerCase().includes(q.search.toLowerCase())).map((c) => {
      const t = empty(); c.daily.slice(-n).forEach((r) => add(t, r));
      return { id: c.id, name: c.spec.name, status: state.campStatus[c.id], objective: c.spec.objective, budgetDaily: state.campBudget[c.id], platform: c.spec.platform, account: c.spec.account, client: c.spec.client, ...derive(t) };
    }));
  }
  const childMatch = p.match(/^\/campaigns\/([^/]+)\/children$/);
  if (childMatch) {
    const c = CAMPS.find((x) => x.id === childMatch[1]); if (!c) return R([] as any);
    return R(c.adSets.map((s) => {
      const setAgg = empty(); s.adIdx.forEach((i: number) => add(setAgg, c.ads[i].totals));
      return {
        id: s.id, name: s.name, status: s.status, targeting: state.targeting[s.id] ?? s.targeting, ...derive(setAgg),
        ads: s.adIdx.map((i: number) => { const a = c.ads[i]; return { id: a.id, name: a.name, status: 'ACTIVE', creative: a.creative, ...derive(a.totals) }; }),
      };
    }));
  }
  let m;
  if ((m = p.match(/^\/campaigns\/([^/]+)\/(pause|activate)$/))) { state.campStatus[m[1]] = m[2] === 'pause' ? 'PAUSED' : 'ACTIVE'; return R({ ok: true }); }
  if ((m = p.match(/^\/campaigns\/([^/]+)\/duplicate$/))) return R({ id: 'copy', ok: true });
  if ((m = p.match(/^\/campaigns\/([^/]+)\/budget$/))) { state.campBudget[m[1]] = body?.budgetDaily; return R({ ok: true }); }
  if ((m = p.match(/^\/campaigns\/adsets\/([^/]+)\/targeting$/))) { state.targeting[m[1]] = body?.targeting; return R({ targeting: body?.targeting }); }

  // insights
  if (p === '/insights/diagnostics') return R(mockDiagnostics());
  if (p === '/insights/recommendations') return R(RECS.filter((r) => (state.recStatus[r.id] ?? r.status) !== 'DISMISSED').map((r) => ({ ...r, status: state.recStatus[r.id] ?? r.status })));
  if ((m = p.match(/^\/insights\/recommendations\/([^/]+)\/(apply|undo|dismiss)$/))) { state.recStatus[m[1]] = m[2] === 'apply' ? 'APPLIED' : m[2] === 'undo' ? 'UNDONE' : 'DISMISSED'; return R({ ok: true }); }
  if (p === '/insights/anomalies') return R(ANOMALIES);
  if (p === '/insights/anomalies/detect') return R({ created: 0 });
  if (p === '/insights/creatives/ranking') {
    const out: any[] = [];
    for (const c of CAMPS) for (const a of c.ads) { const d = derive(a.totals); out.push({ id: a.id, name: a.name, status: 'ACTIVE', campaign: c.spec.name, platform: c.spec.platform, creative: { ...a.creative, primaryText: 'Criativo de demonstração.' }, ctr: d.ctr, cpa: d.cpa, roas: d.roas, spend: d.spend, fatigue: a.fatigue }); }
    return R(out.sort((a, b) => b.roas - a.roas));
  }

  // chat
  if (p === '/chat/history') return R(state.chat);
  if (p === '/chat' && method === 'POST') {
    state.chat.push({ id: `u${Date.now()}`, role: 'user', content: body.question });
    const ans = { id: `a${Date.now()}`, role: 'assistant', content: mockChat(body.question) };
    state.chat.push(ans); return R(ans);
  }

  // rules
  if (p === '/rules' && method === 'GET') return R(RULES);
  if (p === '/rules/preview') return R(mockPreview());
  if (p === '/rules/run-now') return R(mockPreview());
  if (p === '/rules' && method === 'POST') return R({ id: 'new', ...body });
  if (/^\/rules\//.test(p)) return R({ ok: true });

  // goals
  if (p === '/goals') return R(GOALS);

  // creatives
  if (p === '/creatives' && method === 'GET') return R([]);
  if (p === '/creatives/generate') return R(mockCreatives(body));

  // reports
  if (p === '/reports' && method === 'GET') return R(REPORTS);
  if (p.startsWith('/reports/shared/')) return R(mockSharedReport());
  if (/^\/reports\//.test(p)) return R({ ok: true, sent: true, recipients: [] });
  if (p === '/reports' && method === 'POST') return R({ id: 'new', ...body });

  // connections / clients / audit / notifications / billing
  if (p === '/connections' && method === 'GET') return R(CONNECTIONS);
  if (/^\/connections\/.*\/(sync|reauth)$/.test(p)) return R({ ok: true, queued: true });
  if (/^\/connections\/.*\/connect$/.test(p)) return R({ authUrl: '/conexoes/mock-oauth' });
  if (p === '/clients') return R(CLIENTS);
  if (p === '/audit') return R(AUDIT);
  if (p === '/notifications') return R({ items: NOTIFICATIONS, unread: ANOMALIES.length });
  if (p === '/notifications/read-all') return R({ ok: true });
  if (p === '/billing/plans') return R({ plans: PLANS, liveMode: false });
  if (p === '/billing/subscription') return R({ plan: state.plan, liveMode: false, stripeCustomerId: null });
  if (p === '/billing/checkout') { state.plan = body.plan; return R({ mode: 'demo', url: '#', applied: true }); }

  // radar
  if (p === '/radar/products') { let items = RADAR_PRODUCTS; if (q.country) items = items.filter((x) => x.country === q.country || x.country === 'GLOBAL'); if (q.platform) items = items.filter((x) => x.platforms.includes(q.platform)); return R({ source: 'curated', items: [...items].sort((a, b) => b.demandScore - a.demandScore) }); }
  if (p === '/radar/videos') { let items = RADAR_VIDEOS; if (q.platform) items = items.filter((x) => x.platform === q.platform); if (q.country) items = items.filter((x) => x.country === q.country || x.country === 'GLOBAL'); return R({ source: 'curated', items: [...items].sort((a, b) => b.growth24h - a.growth24h) }); }
  if (p === '/radar/posting-windows') return R(POSTING_WINDOWS);
  if (p === '/radar/analyze-post') return R(mockAnalyzePost(body));

  // fallback
  return R({} as any);
}

// ---------- conteúdos estáticos ----------
function mockDiagnostics() {
  const stats = CAMPS.map((c) => { const t = empty(); c.daily.slice(-30).forEach((r) => add(t, r)); return { name: c.spec.name, platform: c.spec.platform, ...derive(t) }; });
  const good = [...stats].sort((a, b) => b.roas - a.roas).slice(0, 3);
  const bad = [...stats].filter((r) => r.roas < 1.5).sort((a, b) => (b.spend - b.revenue) - (a.spend - a.revenue)).slice(0, 3);
  const brl = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  const md = ['## O que está indo bem', ...good.map((g) => `- **${g.name}** (${g.platform}): ROAS ${g.roas.toFixed(1)} com ${brl(g.revenue)} de receita.`), '', '## O que está queimando verba', ...(bad.length ? bad.map((b) => `- **${b.name}** (${b.platform}): ROAS ${b.roas.toFixed(1)} — desperdício de ${brl(Math.max(b.spend - b.revenue, 0))}.`) : ['- Nenhuma campanha com desperdício relevante.']), '', '## Prioridade da semana', bad.length ? `Realocar a verba de **${bad[0].name}** para **${good[0]?.name}**.` : `Escalar **${good[0]?.name}** gradualmente.`].join('\n');
  return { source: 'heuristic', markdown: md };
}
function mockChat(qn: string) {
  const q = qn.toLowerCase();
  const rows = CAMPS.map((c) => { const t = empty(); c.daily.slice(-7).forEach((r) => add(t, r)); return { name: c.spec.name, platform: c.spec.platform, ...derive(t) }; }).filter((r) => r.spend > 50);
  const best = [...rows].sort((a, b) => b.roas - a.roas)[0];
  const worst = [...rows].sort((a, b) => a.roas - b.roas)[0];
  const note = '\n\n*(Modo demonstração — configure a IA para análises completas.)*';
  if (q.includes('escalar') || q.includes('criativo')) return `A melhor candidata a escala é **${best?.name}** (${best?.platform}), ROAS ${best?.roas.toFixed(1)}. Aumente +20% a cada 3 dias.${note}`;
  if (q.includes('caí') || q.includes('queda') || q.includes('venda')) return `O principal ofensor é **${worst?.name}** (ROAS ${worst?.roas.toFixed(1)}). Confira as anomalias abertas.${note}`;
  return `Melhor campanha: **${best?.name}** (ROAS ${best?.roas.toFixed(1)}). Pior: **${worst?.name}** (ROAS ${worst?.roas.toFixed(1)}).${note}`;
}
function mockPreview() {
  const fired = CAMPS.filter((c) => state.campStatus[c.id] === 'ACTIVE').map((c) => { const t = empty(); c.daily.slice(-3).forEach((r) => add(t, r)); const d = derive(t); if (c.spec.roas >= 3.05) return { rule: 'Escalar +20% campanhas com ROAS > 3 por 2 dias', target: c.spec.name, action: 'INCREASE_BUDGET', detail: `ROAS > 3 (agregado: ${d.roas})`, from: state.campBudget[c.id], to: round(state.campBudget[c.id] * 1.2) }; if (d.cpa > 50) return { rule: 'Pausar conjunto com CPA > R$ 50 por 3 dias', target: c.spec.name, action: 'PAUSE', detail: `CPA > 50 (agregado: ${d.cpa})` }; return null; }).filter(Boolean);
  return { dryRun: true, count: fired.length, fired };
}
function mockCreatives(body: any) {
  const a = body?.audience ?? 'seu público'; const prod = body?.product ?? 'seu produto';
  return { angles: ['Dor', 'Desejo', 'Prova social'], creatives: [
    { id: 'g1', headline: 'Cansado de resultados fracos?', primaryText: `Se você já investiu em ${prod} e não viu retorno, o problema é a estratégia. ${a} que aplicaram a abordagem certa mudaram de patamar.`, description: `A solução que ${a} procuram.`, cta: 'SAIBA_MAIS', angle: 'Dor' },
    { id: 'g2', headline: 'Imagine seu resultado em 30 dias', primaryText: `${prod} feito do jeito certo transforma a rotina. Método, consistência e acompanhamento.`, description: 'Comece hoje.', cta: 'COMPRAR_AGORA', angle: 'Desejo' },
    { id: 'g3', headline: '+2.000 clientes satisfeitos', primaryText: `"Em 3 semanas já vi diferença." Junte-se a quem já resolveu.`, description: 'Veja os depoimentos.', cta: 'CADASTRE_SE', angle: 'Prova social' },
  ] };
}
function mockAnalyzePost(input: any) {
  const tag = (input?.niche ?? 'nicho').toLowerCase().replace(/\s+/g, '');
  return { source: 'heuristic', plan: {
    verdict: `"${input?.title}" tem potencial se o gancho aparecer nos 2 primeiros segundos — hoje o título descreve, mas não fisga.`,
    hookSuggestions: [`Comece com o resultado final na tela e só depois o processo`, `Texto com número específico no primeiro frame`, `Pergunta direta ao público de ${input?.niche} que gera comentário`],
    perPlatform: [
      { platform: 'TIKTOK', title: `${input?.title} (ninguém te conta isso)`, hashtags: [`#${tag}`, '#fy', '#dicas', '#brasil'], bestTime: 'ter–qui · 19h–22h', formatTip: '9:16, corte a cada 2-3s, máx. 35s', paidTip: 'Suba como Spark Ad o post que performar melhor em 48h' },
      { platform: 'REELS', title: input?.title, hashtags: [`#${tag}`, '#reels', '#viral'], bestTime: 'seg–sex · 18h–21h', formatTip: 'Áudio em alta; 1º frame legível sem som', paidTip: 'Impulsione o de melhor taxa de salvamento' },
      { platform: 'SHORTS', title: `${input?.title} #shorts`, hashtags: [`#${tag}`, '#shorts'], bestTime: 'todos · 12h–15h ou 19h–23h', formatTip: 'Termine com gancho para o vídeo longo', paidTip: null },
      { platform: 'YOUTUBE', title: `${input?.title} — o guia completo`, hashtags: [`#${tag}`], bestTime: 'qui–dom · 11h ou 18h', formatTip: 'Versão 8-12min; entregue a promessa no 1º minuto', paidTip: 'Destino de tráfego de descoberta' },
    ],
  } };
}

const RECS = [
  { id: 'r1', type: 'REALLOCATE_BUDGET', priority: 1, status: 'OPEN', title: 'Realocar R$ 150/dia de "Genéricas — Suplementos" para "Marca — Vitta"', why: 'A campanha de genéricas tem ROAS de 1,1 há 21 dias, enquanto a de marca mantém ROAS 6,2 e perde impressões por orçamento.', impactEstimate: '+R$ 18.400/mês em receita estimada' },
  { id: 'r2', type: 'SWAP_CREATIVE', priority: 2, status: 'OPEN', title: 'Trocar criativos da campanha "[CBO] Escala" — fadiga detectada', why: 'CTR caiu 38% nos últimos 14 dias e a frequência subiu de 1,6 para 3,4.', impactEstimate: 'Recuperar ~R$ 6.100/mês' },
  { id: 'r3', type: 'SCALE_CAMPAIGN', priority: 3, status: 'OPEN', title: 'Escalar "[Remarketing] Carrinho Abandonado" em +20%', why: 'ROAS 7,8 estável há 30 dias com CPA 52% abaixo da meta.', impactEstimate: '+R$ 4.700/mês com risco baixo' },
  { id: 'r4', type: 'PAUSE_ADSET', priority: 4, status: 'OPEN', title: 'Pausar "[VSA] Top View Lançamento" — CPA acima da meta', why: 'CPA de R$ 96 contra meta de R$ 45, sem melhora após 14 dias.', impactEstimate: 'Economia de ~R$ 2.400/mês' },
  { id: 'r5', type: 'ADJUST_SCHEDULE', priority: 5, status: 'OPEN', title: 'Concentrar lances entre 19h e 22h nos dias úteis', why: '41% das conversões acontecem entre 19h–22h com CPA 35% menor.', impactEstimate: '-18% de CPA estimado' },
];
const ANOMALIES = [
  { id: 'a1', severity: 'CRITICAL', metric: 'SPEND_SPIKE', message: 'Gasto da campanha "[CBO] Escala" subiu 62% nas últimas 24h sem aumento de conversões.', detectedAt: new Date().toISOString() },
  { id: 'a2', severity: 'CRITICAL', metric: 'NO_DELIVERY', message: 'Conta TikTok — Academia Forte sem entrega há 2 dias: token expirado.', detectedAt: new Date().toISOString() },
  { id: 'a3', severity: 'WARNING', metric: 'CONVERSION_DROP', message: 'Conversões da conta caíram 28% vs. média dos últimos 7 dias. Verifique o tracking.', detectedAt: new Date().toISOString() },
];
const NOTIFICATIONS = [
  ...ANOMALIES.map((a) => ({ id: `n-${a.id}`, type: 'anomaly', severity: a.severity, title: a.metric === 'SPEND_SPIKE' ? 'Pico de gasto' : a.metric === 'NO_DELIVERY' ? 'Conta sem entrega' : 'Queda de conversões', message: a.message, at: a.detectedAt })),
  { id: 'n-r1', type: 'rule', severity: 'INFO', title: 'Regra disparada: Pausar conjunto com CPA > R$ 50', message: '[VSA] Top View — CPA de R$ 96 por 3 dias → pausado', at: new Date(Date.now() - 3600000).toISOString() },
];
const RULES = [
  { id: 'ru1', name: 'Escalar +20% campanhas com ROAS > 3 por 2 dias', enabled: true, metric: 'ROAS', operator: 'GT', threshold: '3', windowDays: 2, action: 'INCREASE_BUDGET', actionValue: '20', lastRunAt: new Date(Date.now() - 3600000).toISOString(), executions: [] },
  { id: 'ru2', name: 'Pausar conjunto com CPA > R$ 50 por 3 dias', enabled: true, metric: 'CPA', operator: 'GT', threshold: '50', windowDays: 3, action: 'PAUSE', actionValue: null, lastRunAt: new Date(Date.now() - 3600000).toISOString(), executions: [{ id: 'e1', firedAt: new Date(Date.now() - 7200000).toISOString(), targetName: '[VSA] Top View', detail: 'CPA de R$ 96 > R$ 50 por 3 dias → pausado.' }] },
];
const GOALS = ['Loja Vitta', 'Clínica Sorriso', 'Academia Forte'].map((name, i) => {
  const cid = clientId(name);
  const t = empty(); CAMPS.filter((c) => c.spec.client === name).forEach((c) => c.daily.forEach((r) => add(t, r)));
  const d = derive(t); const pace = 30 / Math.max(new Date().getUTCDate() - 1, 1);
  const budget = name === 'Loja Vitta' ? 45000 : 12000; const targetRoas = name === 'Loja Vitta' ? 4 : 3;
  return { id: `g${i}`, client: name, clientId: cid, month: new Date().toISOString().slice(0, 7), targets: { roas: targetRoas, cpa: name === 'Clínica Sorriso' ? 60 : 45, budget }, current: { spend: d.spend, revenue: d.revenue, roas: d.roas, cpa: d.cpa, conversions: d.conversions }, progress: { budgetUsedPct: round((d.spend / budget) * 100, 1), roasVsTargetPct: round((d.roas / targetRoas) * 100, 1) }, forecast: { spend: round(d.spend * pace), revenue: round(d.revenue * pace), conversions: Math.round(d.conversions * pace), roas: d.roas, willExceedBudget: d.spend * pace > budget, willHitRoas: d.roas >= targetRoas } };
});
const REPORTS = ['Loja Vitta', 'Clínica Sorriso', 'Academia Forte'].map((name, i) => ({ id: `rep${i}`, name: `Relatório Mensal — ${name}`, schedule: 'MONTHLY', shareToken: `demo-${clientId(name)}`, recipients: [`contato@${name.toLowerCase().replace(/\s/g, '')}.com.br`], lastSentAt: null, client: { name } }));
const CONNECTIONS = [
  { id: 'ac1', platform: 'GOOGLE', externalId: '842-113-9027', name: 'Google Ads — Loja Vitta', client: 'Loja Vitta', status: 'ACTIVE', statusDetail: null, lastSyncAt: new Date(Date.now() - 1800000).toISOString(), currency: 'BRL' },
  { id: 'ac2', platform: 'GOOGLE', externalId: '311-902-5561', name: 'Google Ads — Clínica Sorriso', client: 'Clínica Sorriso', status: 'ACTIVE', statusDetail: null, lastSyncAt: new Date(Date.now() - 2400000).toISOString(), currency: 'BRL' },
  { id: 'ac3', platform: 'META', externalId: 'act_5530919274', name: 'Meta Ads — Loja Vitta', client: 'Loja Vitta', status: 'ACTIVE', statusDetail: null, lastSyncAt: new Date(Date.now() - 900000).toISOString(), currency: 'BRL' },
  { id: 'ac4', platform: 'META', externalId: 'act_8812203471', name: 'Meta Ads — Academia Forte', client: 'Academia Forte', status: 'ACTIVE', statusDetail: null, lastSyncAt: new Date(Date.now() - 1200000).toISOString(), currency: 'BRL' },
  { id: 'ac5', platform: 'TIKTOK', externalId: '7218837745', name: 'TikTok Ads — Loja Vitta', client: 'Loja Vitta', status: 'ACTIVE', statusDetail: null, lastSyncAt: new Date(Date.now() - 600000).toISOString(), currency: 'BRL' },
  { id: 'ac6', platform: 'TIKTOK', externalId: '7301114', name: 'TikTok Ads — Academia Forte', client: 'Academia Forte', status: 'EXPIRED', statusDetail: 'Token expirado — reautentique a conexão', lastSyncAt: new Date(Date.now() - 172800000).toISOString(), currency: 'BRL' },
];
const CLIENTS = ['Loja Vitta', 'Clínica Sorriso', 'Academia Forte'].map((name) => ({ id: clientId(name), name, accounts: CONNECTIONS.filter((c) => c.client === name).map((c) => ({ id: c.id, name: c.name, platform: c.platform, status: c.status })) }));
const AUDIT = [
  { id: 'au1', action: 'RULE_FIRED', targetType: 'CAMPAIGN', targetId: 'c10demoxxx', before: null, after: { rule: 'Pausar CPA alto' }, createdAt: new Date(Date.now() - 7200000).toISOString(), user: null },
  { id: 'au2', action: 'RECOMMENDATION_APPLIED', targetType: 'RECOMMENDATION', targetId: 'r3demoxxx', before: null, after: { type: 'SCALE' }, createdAt: new Date(Date.now() - 10800000).toISOString(), user: { name: 'Gestor Demo', email: 'demo@trafegoai.com' } },
];
const PLANS = [
  { id: 'STARTER', name: 'Starter', monthly: 9700, annual: 97000, highlights: ['1 conta por plataforma', 'Dashboard unificado', 'Diagnóstico de IA básico', 'Alertas de anomalias'] },
  { id: 'PRO', name: 'Pro', monthly: 29700, annual: 297000, highlights: ['Contas ilimitadas por plataforma', 'Recomendações + aplicar com 1 clique', 'Regras de automação', 'Gerador de criativos com IA'], featured: true },
  { id: 'AGENCY', name: 'Agência', monthly: 69700, annual: 697000, highlights: ['Clientes ilimitados', 'Relatórios white-label agendados', 'Dashboard compartilhável por link', 'Papéis e permissões por cliente'] },
];
function mockSharedReport() {
  const t = empty(); CAMPS.forEach((c) => c.daily.slice(-30).forEach((r) => add(t, r)));
  const byDay = new Map<string, any>(); CAMPS.forEach((c) => c.daily.slice(-30).forEach((r) => { if (!byDay.has(r.date)) byDay.set(r.date, empty()); add(byDay.get(r.date), r); }));
  const byP = new Map<string, any>(); CAMPS.forEach((c) => { if (!byP.has(c.spec.platform)) byP.set(c.spec.platform, empty()); c.daily.slice(-30).forEach((r) => add(byP.get(c.spec.platform), r)); });
  return { name: 'Relatório Mensal — Demo', client: 'Loja Vitta', brand: { color: '#6366f1', agency: 'Agência Demo Performance' }, summary: { totals: derive(t), change: {} }, timeseries: [...byDay.entries()].map(([date, v]) => ({ date, ...derive(v) })), platformSplit: [...byP.entries()].map(([platform, v]) => ({ platform, ...derive(v) })) };
}

// radar (subconjunto do backend)
const RADAR_PRODUCTS = [
  { id: 'p1', name: 'Creatina monohidratada 300g', category: 'Suplementos', platforms: ['TIKTOK_SHOP', 'MERCADO_LIVRE'], country: 'BR', priceRange: 'R$ 60–120', demandScore: 94, growth7d: 38, competition: 'ALTA', trend: [42, 45, 48, 52, 55, 61, 63, 70, 74, 81, 89, 94], insight: 'Onda fitness contínua + "gym tok". Diferencie por sabor/pureza e prova social de resultados em 30 dias.' },
  { id: 'p2', name: 'Luminária sunset lamp 2.0', category: 'Casa & Decoração', platforms: ['TIKTOK_SHOP', 'SHOPEE'], country: 'GLOBAL', priceRange: 'R$ 35–90', demandScore: 88, growth7d: 61, competition: 'MEDIA', trend: [12, 15, 14, 18, 25, 31, 38, 47, 52, 66, 79, 88], insight: 'Estética "room makeover". Antes/depois do quarto converte muito; CPC baixo em decoração.' },
  { id: 'p3', name: 'Escova alisadora térmica bivolt', category: 'Beleza', platforms: ['SHOPEE', 'MERCADO_LIVRE'], country: 'BR', priceRange: 'R$ 80–160', demandScore: 86, growth7d: 24, competition: 'ALTA', trend: [55, 58, 54, 60, 63, 61, 66, 70, 72, 75, 81, 86], insight: 'Demanda perene com pico pré-festas. Demonstração em cabelo real com timer ("pronta em 6 min").' },
  { id: 'p4', name: 'Garrafinha marcador de horário 2L', category: 'Fitness', platforms: ['SHOPEE', 'TIKTOK_SHOP'], country: 'BR', priceRange: 'R$ 25–55', demandScore: 82, growth7d: 45, competition: 'BAIXA', trend: [20, 22, 26, 24, 30, 35, 41, 48, 55, 63, 74, 82], insight: '"Hidratação estética" + volta às aulas. Margem alta, frete leve; ótimo produto de entrada para tráfego pago.' },
  { id: 'p5', name: 'Mini impressora térmica de bolso', category: 'Papelaria criativa', platforms: ['TIKTOK_SHOP', 'SHOPEE'], country: 'GLOBAL', priceRange: 'R$ 90–180', demandScore: 79, growth7d: 52, competition: 'MEDIA', trend: [18, 20, 25, 23, 28, 34, 40, 45, 52, 60, 71, 79], insight: 'Estudantes com "aesthetic notes". POV de estudo tem retenção altíssima; público 16-24.' },
  { id: 'p6', name: 'Kit clareador dental LED', category: 'Beleza', platforms: ['SHOPEE', 'AMAZON'], country: 'BR', priceRange: 'R$ 50–130', demandScore: 77, growth7d: 19, competition: 'ALTA', trend: [48, 52, 50, 55, 58, 60, 62, 66, 68, 70, 74, 77], insight: 'Antes/depois domina. Cuidado com claims de saúde — use "aparência", não "tratamento".' },
  { id: 'p7', name: 'Fone condução óssea esportivo', category: 'Eletrônicos', platforms: ['AMAZON', 'MERCADO_LIVRE'], country: 'GLOBAL', priceRange: 'R$ 120–350', demandScore: 68, growth7d: 41, competition: 'MEDIA', trend: [25, 28, 30, 34, 38, 42, 45, 50, 54, 58, 63, 68], insight: 'Corredores migrando de in-ear. Ticket maior = ótimo para funil de remarketing pago.' },
  { id: 'p8', name: 'Organizador maquiagem acrílico giratório', category: 'Casa & Decoração', platforms: ['SHOPEE', 'TIKTOK_SHOP'], country: 'BR', priceRange: 'R$ 45–95', demandScore: 69, growth7d: 33, competition: 'BAIXA', trend: [22, 25, 28, 30, 34, 38, 42, 48, 52, 58, 64, 69], insight: '"Organize with me" retém muito. Produto visual — invista em demonstração ASMR.' },
];
const RADAR_VIDEOS = [
  { id: 'v1', title: 'POV: você acordou 4h47 para treinar (rotina realista)', platform: 'TIKTOK', country: 'BR', category: 'Fitness', views: 12400000, growth24h: 84, format: 'POV cinematográfico 9:16 · 28s', hook: 'Relógio marcando 4:47 + despertador cortado no 1º segundo', whyItWorks: 'Rotina aspiracional + realismo. Comentários "vale a pena?" alimentam o algoritmo.' },
  { id: 'v2', title: 'I tested 5 viral Amazon kitchen gadgets', platform: 'SHORTS', country: 'US', category: 'Reviews', views: 8900000, growth24h: 66, format: 'Talking-head + demo · 58s', hook: '"Number 3 should be illegal" no 1º frame', whyItWorks: 'Lista + curiosidade. Cada gadget é um mini-loop. Alto potencial de afiliado.' },
  { id: 'v3', title: 'Transformei meu quarto gastando R$ 300', platform: 'REELS', country: 'BR', category: 'Casa & Decoração', views: 6700000, growth24h: 59, format: 'Timelapse antes/depois · 22s', hook: 'Quarto bagunçado com "meu quarto era assim"', whyItWorks: 'Antes/depois barato é replicável — salva/compartilha alto. Produtos aparecem naturais.' },
  { id: 'v4', title: 'Nail art com produtos da Shopee que parecem caros', platform: 'TIKTOK', country: 'BR', category: 'Beleza', views: 5800000, growth24h: 47, format: 'Close-up macro ASMR · 41s', hook: 'Mão entrando com unha finalizada + "tudo da Shopee"', whyItWorks: 'ASMR + revelação de preço baixo. Comentários pedindo link = tráfego orgânico.' },
  { id: 'v5', title: 'ASMR restocking da minha geladeira de bebidas', platform: 'TIKTOK', country: 'US', category: 'ASMR/Organização', views: 7300000, growth24h: 38, format: 'Top-down restock · 52s', hook: '1ª lata deslizando no organizador acrílico', whyItWorks: 'Restock ASMR é perene. Organizadores aparecem — categoria inteira surfa esses vídeos.' },
  { id: 'v6', title: 'Unboxing mini impressora + organizando caderno', platform: 'TIKTOK', country: 'GLOBAL', category: 'Estudo/aesthetic', views: 3800000, growth24h: 72, format: 'Top-down desk POV · 36s', hook: 'Peel do papel térmico saindo (satisfying)', whyItWorks: 'Study-tok global. Som satisfying + produto visível = vende sem parecer anúncio.' },
];
const POSTING_WINDOWS = [
  { platform: 'TIKTOK', days: 'ter–qui', windows: ['11h–13h', '19h–22h'], notes: 'Poste 1-3x/dia; pico do FYP brasileiro é 20h-22h. Vídeos <35s com gancho nos 2 primeiros segundos.' },
  { platform: 'REELS', days: 'seg–sex', windows: ['12h–14h', '18h–21h'], notes: 'Reels com áudio em alta ganham distribuição extra. Poste no feed + stories com enquete.' },
  { platform: 'SHORTS', days: 'todos', windows: ['12h–15h', '19h–23h'], notes: 'Shorts alimentam o canal longo: termine com gancho. Consistência diária pesa mais que horário.' },
  { platform: 'YOUTUBE', days: 'qui–dom', windows: ['11h', '18h'], notes: 'Longos: publique 2h antes do pico para indexar. Thumb + título respondem 80% do CTR.' },
];
