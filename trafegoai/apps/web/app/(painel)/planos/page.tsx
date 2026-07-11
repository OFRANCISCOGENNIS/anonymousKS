'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useApi } from '@/lib/useApi';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { Badge, ErrorState, PageHeader, Skeleton } from '@/components/ui';
import { brl } from '@/lib/format';

interface PlanDef {
  id: 'STARTER' | 'PRO' | 'AGENCY';
  name: string;
  monthly: number;
  annual: number;
  highlights: string[];
  featured?: boolean;
}

function PlanosInner() {
  const params = useSearchParams();
  const org = useAuthStore((s) => s.org);
  const setProfile = useAuthStore((s) => s.setProfile);
  const user = useAuthStore((s) => s.user);
  const { data, loading, error, retry } = useApi<{ plans: PlanDef[]; liveMode: boolean }>(() => api.get('/billing/plans'), []);
  const [interval, setInterval] = useState<'monthly' | 'annual'>('monthly');
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(params.get('sucesso') ? 'Plano ativado com sucesso ✓' : null);

  async function subscribe(plan: PlanDef) {
    setBusy(plan.id);
    try {
      const res = await api.post<{ mode: string; url: string; applied: boolean }>('/billing/checkout', { plan: plan.id, interval });
      if (res.mode === 'live') {
        window.location.href = res.url; // Stripe Checkout
      } else {
        // modo demo: plano já aplicado no backend
        if (org) setProfile(user, { ...org, plan: plan.id });
        setToast(`Plano ${plan.name} ativado (modo demonstração — sem cobrança real) ✓`);
        setTimeout(() => setToast(null), 5000);
      }
    } catch (e) {
      setToast(e instanceof Error ? e.message : 'Falha ao iniciar o checkout');
      setTimeout(() => setToast(null), 5000);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="Planos & Assinatura"
        subtitle={`Plano atual: ${org?.plan ?? '—'}. Faça upgrade quando precisar de mais contas, automação ou white-label.`}
      />

      {/* Toggle mensal/anual */}
      <div className="mb-6 flex items-center justify-center gap-3">
        <span className={interval === 'monthly' ? 'font-medium' : 'text-muted'}>Mensal</span>
        <button
          role="switch"
          aria-checked={interval === 'annual'}
          aria-label="Alternar entre cobrança mensal e anual"
          className="relative h-6 w-11 rounded-full bg-border transition-colors"
          onClick={() => setInterval((v) => (v === 'monthly' ? 'annual' : 'monthly'))}
        >
          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-accent transition-all ${interval === 'annual' ? 'left-[22px]' : 'left-0.5'}`} />
        </button>
        <span className={interval === 'annual' ? 'font-medium' : 'text-muted'}>
          Anual <Badge tone="good">2 meses grátis</Badge>
        </span>
      </div>

      {loading ? (
        <div className="grid gap-6 md:grid-cols-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-80" />)}</div>
      ) : error ? (
        <ErrorState message={error} onRetry={retry} />
      ) : (
        <>
          {data!.liveMode ? null : (
            <p className="mb-4 rounded-lg bg-accent/10 px-3 py-2 text-center text-xs text-ink-2">
              Modo demonstração: sem <code>STRIPE_SECRET_KEY</code>, o upgrade é aplicado na hora sem cobrança. Configure o Stripe no <code>.env</code> para o checkout real.
            </p>
          )}
          <div className="grid gap-6 md:grid-cols-3">
            {data!.plans.map((plan) => {
              const price = interval === 'annual' ? plan.annual : plan.monthly;
              const isCurrent = org?.plan === plan.id;
              return (
                <div key={plan.id} className={`card flex flex-col ${plan.featured ? 'border-accent ring-1 ring-accent' : ''}`}>
                  {plan.featured && <span className="badge mb-2 self-start bg-accent/15 text-indigo-300">Mais popular</span>}
                  <h2 className="font-display text-xl font-bold">{plan.name}</h2>
                  <p className="mt-1 font-display text-3xl font-bold text-accent">
                    {brl(price / 100)}
                    <span className="text-sm font-normal text-muted">/{interval === 'annual' ? 'ano' : 'mês'}</span>
                  </p>
                  <ul className="mt-4 flex-1 space-y-2 text-sm text-ink-2">
                    {plan.highlights.map((h) => <li key={h} className="flex gap-2"><span className="text-green-400" aria-hidden>✓</span>{h}</li>)}
                  </ul>
                  <button
                    className={`mt-6 w-full ${plan.featured ? 'btn-primary' : 'btn-ghost'}`}
                    disabled={isCurrent || busy === plan.id}
                    onClick={() => subscribe(plan)}
                  >
                    {isCurrent ? 'Plano atual' : busy === plan.id ? 'Processando…' : `Assinar ${plan.name}`}
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 rounded-lg border border-border bg-surface px-4 py-3 text-sm shadow-xl" role="status">{toast}</div>
      )}
    </div>
  );
}

export default function PlanosPage() {
  return (
    <Suspense>
      <PlanosInner />
    </Suspense>
  );
}
