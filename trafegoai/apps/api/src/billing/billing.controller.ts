import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { IsIn } from 'class-validator';
import { Request } from 'express';
import { Auth, JwtGuard } from '../auth/jwt.guard';
import { JwtPayload } from '../auth/auth.service';
import { BillingService } from './billing.service';

class CheckoutDto {
  @IsIn(['STARTER', 'PRO', 'AGENCY']) plan: string;
  @IsIn(['monthly', 'annual']) interval: 'monthly' | 'annual';
}

@Controller('billing')
export class BillingController {
  constructor(private billing: BillingService) {}

  /** Catálogo de planos (público — usado na landing e na página de planos). */
  @Get('plans')
  plans() {
    return { plans: this.billing.plans(), liveMode: this.billing.liveMode };
  }

  @Get('subscription')
  @UseGuards(JwtGuard)
  subscription(@Auth() auth: JwtPayload) {
    return this.billing.subscription(auth.orgId);
  }

  /** Inicia o checkout do plano escolhido (Stripe em produção, simulado em demo). */
  @Post('checkout')
  @UseGuards(JwtGuard)
  checkout(@Auth() auth: JwtPayload, @Body() dto: CheckoutDto, @Req() req: Request) {
    const appUrl = (req.headers['origin'] as string) ?? process.env.APP_URL ?? 'http://localhost:3000';
    return this.billing.checkout(auth, dto.plan, dto.interval, appUrl);
  }

  /** Webhook do Stripe (checkout.session.completed → aplica o plano). */
  @Post('webhook')
  webhook(@Body() event: { type: string; data: { object: unknown } }) {
    return this.billing.handleWebhook(event as never);
  }
}
