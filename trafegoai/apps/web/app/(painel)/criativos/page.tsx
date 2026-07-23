'use client';

import { FormEvent, useMemo, useState } from 'react';
import { useApi } from '@/lib/useApi';
import { api } from '@/lib/api';
import { Badge, EmptyState, ErrorState, PageHeader, Skeleton } from '@/components/ui';
import { brl, num, pct, ratio, PLATFORM_LABEL } from '@/lib/format';

interface RankedAd {
  id: string; name: string; campaign: string; platform: string;
  ctr: number; cpa: number; roas: number; spend: number;
  creative: { headline: string; primaryText: string | null; imageUrl: string | null } | null;
  fatigue: { fatigued: boolean; ctrDrop: number; freq: number };
}
interface Generated { angles: string[]; creatives: Array<{ id: string; headline: string; primaryText: string; description: string; cta: string; angle: string | null }> }

// Métricas do comparativo: dir=1 → maior é melhor; dir=-1 → menor é melhor
const COMPARE_METRICS: Array<{ key: keyof RankedAd; label: string; fmt: (v: number) => string; dir: 1 | -1 }> = [
  { key: 'roas', label: 'ROAS', fmt: ratio, dir: 1 },
  { key: 'ctr', label: 'CTR', fmt: (v) => pct(v), dir: 1 },
  { key: 'cpa', label: 'CPA', fmt: brl, dir: -1 },
  { key: 'spend', label: 'Investimento', fmt: brl, dir: -1 },
];

export default function CriativosPage() {
  const ranking = useApi<RankedAd[]>(() => api.get('/insights/creatives/ranking'), []);
  const [form, setForm] = useState({ platform: 'META', product: '', audience: '', tone: 'confiante e direto' });
  const [generated, setGenerated] = useState<Generated | null>(null);
  const [genBusy, setGenBusy] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  // Comparativo lado a lado
  const [selected, setSelected] = useState<string[]>([]);
  const [comparing, setComparing] = useState(false);

  function toggleSelect(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : prev.length >= 4 ? prev : [...prev, id]));
  }

  const selectedAds = useMemo(
    () => (ranking.data ?? []).filter((a) => selected.includes(a.id)),
    [ranking.data, selected],
  );

  // Vencedor por métrica (para destacar a melhor célula de cada linha)
  const winners = useMemo(() => {
    const w: Record<string, string> = {};
    for (const m of COMPARE_METRICS) {
      let best: RankedAd | null = null;
      for (const ad of selectedAds) {
        const v = ad[m.key] as number;
        if (v <= 0 && m.key !== 'cpa') continue;
        if (!best || (m.dir === 1 ? v > (best[m.key] as number) : v < (best[m.key] as number))) best = ad;
      }
      if (best) w[m.key as string] = best.id;
    }
    return w;
  }, [selectedAds]);

  async function generate(e: FormEvent) {
    e.preventDefault();
    setGenBusy(true);
    setGenError(null);
    try {
      setGenerated(await api.post<Generated>('/creatives/generate', form));
    } catch (err) {
      setGenError(err instanceof Error ? err.message : 'Falha ao gerar criativos');
    } finally {
      setGenBusy(false);
    }
  }

  return (
    <div>
      <PageHeader title="Criativos" subtitle="Ranking por desempenho, detecção de fadiga, comparativo lado a lado e gerador com IA." />

      {/* Gerador com IA */}
      <section className="card mb-6" aria-label="Gerador de criativos com IA">
        <h2 className="mb-3 font-display text-lg font-semibold">✨ Gerar criativos com IA</h2>
        <form className="grid gap-3 md:grid-cols-4" onSubmit={generate}>
          <div>
            <label htmlFor="g-plat" className="mb-1 block text-sm text-ink-2">Plataforma</label>
            <select id="g-plat" className="input" value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })}>
              {Object.entries(PLATFORM_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="g-prod" className="mb-1 block text-sm text-ink-2">Produto/oferta</label>
            <input id="g-prod" className="input" required value={form.product} onChange={(e) => setForm({ ...form, product: e.target.value })} placeholder="Ex.: curso de inglês online" />
          </div>
          <div>
            <label htmlFor="g-pub" className="mb-1 block text-sm text-ink-2">Público-alvo</label>
            <input id="g-pub" className="input" required value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value })} placeholder="Ex.: profissionais 25-40 anos" />
          </div>
          <div className="flex items-end">
            <button type="submit" className="btn-primary w-full" disabled={genBusy}>{genBusy ? 'Gerando…' : 'Gerar 3 criativos'}</button>
          </div>
        </form>
        {genError && <p role="alert" className="mt-3 text-sm text-red-400">{genError}</p>}
        {generated && (
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {generated.creatives.map((c, i) => (
              <div key={c.id ?? i} className="rounded-lg border border-border bg-bg p-3">
                <Badge tone="accent">{generated.angles[i] ?? 'Ângulo'}</Badge>
                <p className="mt-2 font-medium">{c.headline}</p>
                <p className="mt-1 text-sm text-ink-2">{c.primaryText}</p>
                <p className="mt-1 text-xs text-muted">{c.description}</p>
                <p className="mt-2"><Badge>CTA: {c.cta.replace(/_/g, ' ')}</Badge></p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Ranking */}
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold">🏁 Ranking de anúncios (últimos 90 dias)</h2>
        {selected.length > 0 && <span className="text-sm text-muted">{selected.length} selecionado(s) para comparar (máx. 4)</span>}
      </div>
      {ranking.loading ? (
        <Skeleton className="h-64" />
      ) : ranking.error ? (
        <ErrorState message={ranking.error} onRetry={ranking.retry} />
      ) : (ranking.data ?? []).length === 0 ? (
        <EmptyState title="Nenhum anúncio encontrado" hint="Conecte uma conta com campanhas ativas para ver o ranking." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {ranking.data!.map((ad, idx) => {
            const isSel = selected.includes(ad.id);
            return (
              <article key={ad.id} className={`card ${isSel ? 'ring-1 ring-accent' : ad.fatigue.fatigued ? 'border-yellow-500/40' : ''}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs text-muted">#{idx + 1} · {PLATFORM_LABEL[ad.platform]}</p>
                    <h3 className="mt-0.5 truncate font-medium" title={ad.name}>{ad.name}</h3>
                    <p className="truncate text-xs text-muted" title={ad.campaign}>{ad.campaign}</p>
                  </div>
                  <label className="flex shrink-0 cursor-pointer items-center gap-1 text-xs text-ink-2">
                    <input type="checkbox" checked={isSel} onChange={() => toggleSelect(ad.id)} disabled={!isSel && selected.length >= 4} aria-label={`Comparar ${ad.name}`} />
                    Comparar
                  </label>
                </div>
                <div className="mt-3 rounded-lg border border-border bg-bg p-3">
                  <p className="text-sm font-medium">{ad.creative?.headline ?? 'Sem criativo vinculado'}</p>
                  {ad.creative?.primaryText && <p className="mt-1 line-clamp-2 text-xs text-ink-2">{ad.creative.primaryText}</p>}
                </div>
                <dl className="tnum mt-3 grid grid-cols-3 gap-2 text-center text-sm">
                  <div><dt className="text-xs text-muted">ROAS</dt><dd className="font-semibold">{ratio(ad.roas)}</dd></div>
                  <div><dt className="text-xs text-muted">CTR</dt><dd className="font-semibold">{pct(ad.ctr)}</dd></div>
                  <div><dt className="text-xs text-muted">CPA</dt><dd className="font-semibold">{brl(ad.cpa)}</dd></div>
                </dl>
                {ad.fatigue.fatigued && (
                  <p className="mt-2 flex items-center gap-1 text-xs text-yellow-500"><Badge tone="warn">😴 Fadiga</Badge> CTR caiu {pct(ad.fatigue.ctrDrop)}, freq. {ad.fatigue.freq.toFixed(1)}</p>
                )}
              </article>
            );
          })}
        </div>
      )}

      {/* Barra flutuante de comparação */}
      {selected.length >= 2 && !comparing && (
        <div className="fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-full border border-border bg-surface px-5 py-3 shadow-2xl">
          <span className="text-sm">{selected.length} criativos selecionados</span>
          <button className="btn-primary !py-1.5" onClick={() => setComparing(true)}>Comparar lado a lado</button>
          <button className="btn-ghost !py-1.5" onClick={() => setSelected([])}>Limpar</button>
        </div>
      )}

      {/* Painel de comparação lado a lado */}
      {comparing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label="Comparativo de criativos">
          <div className="card max-h-[90vh] w-full max-w-5xl overflow-auto shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-display text-lg font-semibold">Comparativo de criativos</h3>
              <button className="btn-ghost !px-2 !py-1" onClick={() => setComparing(false)} aria-label="Fechar">✕</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="w-32 py-2 text-left font-medium text-muted">Métrica</th>
                    {selectedAds.map((ad) => (
                      <th key={ad.id} className="min-w-48 border-l border-border px-3 py-2 text-left align-top">
                        <p className="truncate font-medium" title={ad.name}>{ad.name}</p>
                        <p className="text-xs font-normal text-muted">{PLATFORM_LABEL[ad.platform]}</p>
                        <p className="mt-1 truncate text-xs font-normal text-ink-2" title={ad.creative?.headline}>“{ad.creative?.headline ?? '—'}”</p>
                        {ad.fatigue.fatigued && <span className="mt-1 inline-block"><Badge tone="warn">😴 Fadiga</Badge></span>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="tnum">
                  {COMPARE_METRICS.map((m) => (
                    <tr key={m.key as string} className="border-t border-border/60">
                      <td className="py-2.5 text-muted">{m.label}</td>
                      {selectedAds.map((ad) => {
                        const win = winners[m.key as string] === ad.id;
                        return (
                          <td key={ad.id} className={`border-l border-border px-3 py-2.5 ${win ? 'font-semibold text-green-400' : ''}`}>
                            {m.fmt(ad[m.key] as number)} {win && <span aria-label="melhor">🏆</span>}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-xs text-muted">🏆 destaca o melhor valor de cada métrica entre os criativos comparados (ROAS/CTR: maior é melhor; CPA/investimento: menor é melhor).</p>
          </div>
        </div>
      )}
    </div>
  );
}
