import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Plan } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
import { AuditService } from '../audit/audit.service';
import { JwtPayload } from '../auth/auth.service';
import { PLANS, PlanDef, findPlan } from './billing.plans';

/**
 * Cobrança via Stripe.
 *
 * Com STRIPE_SECRET_KEY configurada, cria uma Checkout Session real via API do
 * Stripe (chamada REST, sem SDK, no mesmo padrão do LlmService). Sem a chave,
 * roda em MODO DEMO: o checkout aplica o plano na hora e devolve uma URL de
 * sucesso — assim o fluxo de upgrade é demonstrável sem conta Stripe.
 *
 * O webhook (checkout.session.completed) confirma o pagamento em produção.
 */
@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(private prisma: PrismaService, private audit: AuditService) {}

  get liveMode(): boolean {
    return Boolean(process.env.STRIPE_SECRET_KEY);
  }

  plans(): PlanDef[] {
    return PLANS;
  }

  async subscription(orgId: string) {
    const org = await this.prisma.organization.findUniqueOrThrow({ where: { id: orgId } });
    return { plan: org.plan, liveMode: this.liveMode, stripeCustomerId: org.stripeCustomerId };
  }

  async checkout(auth: JwtPayload, planId: string, interval: 'monthly' | 'annual', appUrl: string) {
    const plan = findPlan(planId);
    if (!plan) throw new BadRequestException('Plano inválido');

    if (!this.liveMode) {
      // MODO DEMO: aplica o plano imediatamente (sem cobrança real)
      await this.applyPlan(auth, plan.id, 'demo');
      return { mode: 'demo', url: `${appUrl}/planos?sucesso=1&plano=${plan.id}`, applied: true };
    }

    // MODO REAL: cria a Checkout Session no Stripe
    const priceId = interval === 'annual' ? plan.priceIdAnnual : plan.priceId;
    if (!priceId) throw new BadRequestException(`Price do Stripe não configurado para ${plan.name} (${interval})`);
    const org = await this.prisma.organization.findUniqueOrThrow({ where: { id: auth.orgId } });

    const body = new URLSearchParams({
      mode: 'subscription',
      'line_items[0][price]': priceId,
      'line_items[0][quantity]': '1',
      success_url: `${appUrl}/planos?sucesso=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/planos?cancelado=1`,
      client_reference_id: auth.orgId,
      'metadata[orgId]': auth.orgId,
      'metadata[plan]': plan.id,
      ...(org.stripeCustomerId ? { customer: org.stripeCustomerId } : {}),
    });
    const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: { authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, 'content-type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!res.ok) {
      this.logger.error(`Stripe checkout falhou: ${res.status} ${await res.text()}`);
      throw new BadRequestException('Não foi possível iniciar o checkout no Stripe');
    }
    const session = (await res.json()) as { url: string };
    return { mode: 'live', url: session.url, applied: false };
  }

  /**
   * Webhook do Stripe. PONTO DE INTEGRAÇÃO: em produção, validar a assinatura
   * com STRIPE_WEBHOOK_SECRET (header stripe-signature) antes de confiar no payload.
   */
  async handleWebhook(event: { type: string; data: { object: any } }) {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const orgId = session.metadata?.orgId ?? session.client_reference_id;
      const plan = session.metadata?.plan as Plan | undefined;
      if (orgId && plan) {
        await this.prisma.organization.update({
          where: { id: orgId },
          data: { plan, stripeCustomerId: session.customer ?? undefined },
        });
        await this.audit.log({ orgId }, 'PLAN_CHANGED', 'ORGANIZATION', orgId, null, { plan, via: 'stripe' });
      }
    }
    return { received: true };
  }

  private async applyPlan(auth: JwtPayload, plan: Plan, via: string) {
    const org = await this.prisma.organization.findUniqueOrThrow({ where: { id: auth.orgId } });
    await this.prisma.organization.update({ where: { id: auth.orgId }, data: { plan } });
    await this.audit.log(auth, 'PLAN_CHANGED', 'ORGANIZATION', auth.orgId, { plan: org.plan }, { plan, via });
  }
}
