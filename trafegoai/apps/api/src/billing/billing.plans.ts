import { Plan } from '@prisma/client';

/**
 * Catálogo de planos. Preços em centavos (BRL). O plano anual dá 2 meses grátis
 * (10× o mensal). Em produção, `priceId`/`priceIdAnnual` são os IDs de Price do
 * Stripe; em modo demo eles ficam vazios e o checkout roda simulado.
 */
export interface PlanDef {
  id: Plan;
  name: string;
  monthly: number; // centavos
  annual: number; // centavos (cobrado 1x/ano)
  priceId?: string;
  priceIdAnnual?: string;
  highlights: string[];
  featured?: boolean;
}

export const PLANS: PlanDef[] = [
  {
    id: 'STARTER',
    name: 'Starter',
    monthly: 9700,
    annual: 97000,
    priceId: process.env.STRIPE_PRICE_STARTER,
    priceIdAnnual: process.env.STRIPE_PRICE_STARTER_ANNUAL,
    highlights: ['1 conta por plataforma', 'Dashboard unificado', 'Diagnóstico de IA básico', 'Alertas de anomalias'],
  },
  {
    id: 'PRO',
    name: 'Pro',
    monthly: 29700,
    annual: 297000,
    priceId: process.env.STRIPE_PRICE_PRO,
    priceIdAnnual: process.env.STRIPE_PRICE_PRO_ANNUAL,
    highlights: ['Contas ilimitadas por plataforma', 'Recomendações + aplicar com 1 clique', 'Regras de automação', 'Gerador de criativos com IA'],
    featured: true,
  },
  {
    id: 'AGENCY',
    name: 'Agência',
    monthly: 69700,
    annual: 697000,
    priceId: process.env.STRIPE_PRICE_AGENCY,
    priceIdAnnual: process.env.STRIPE_PRICE_AGENCY_ANNUAL,
    highlights: ['Clientes ilimitados', 'Relatórios white-label agendados', 'Dashboard compartilhável por link', 'Papéis e permissões por cliente'],
  },
];

export function findPlan(id: string): PlanDef | undefined {
  return PLANS.find((p) => p.id === id);
}
