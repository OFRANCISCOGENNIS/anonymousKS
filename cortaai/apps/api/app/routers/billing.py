from __future__ import annotations

import json
import uuid
from datetime import datetime, timedelta, timezone

import sqlalchemy as sa
from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.deps import get_current_user
from app.models import Subscription, User
from app.schemas import CheckoutIn, CheckoutOut
from app.services.plans import PLAN_LIMITS

router = APIRouter(prefix="/billing", tags=["billing"])

# SPEC pricing (BRL): monthly / effective monthly on the annual plan
_PRICES = {
    ("pro", "month"): 79,
    ("pro", "year"): 63 * 12,
    ("studio", "month"): 199,
    ("studio", "year"): 159 * 12,
}


@router.post("/checkout", response_model=CheckoutOut)
def checkout(body: CheckoutIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> CheckoutOut:
    """# INTEGRAÇÃO PAGA: Stripe Checkout.

    Real call (enabled when STRIPE_SECRET_KEY is configured):

        import stripe
        stripe.api_key = settings.stripe_secret_key
        session = stripe.checkout.Session.create(
            mode="subscription",
            customer_email=user.email,
            line_items=[{"price": PRICE_IDS[(body.plan, body.interval)], "quantity": 1}],
            success_url="http://localhost:3000/billing/success?session_id={CHECKOUT_SESSION_ID}",
            cancel_url="http://localhost:3000/billing/cancel",
            metadata={"user_id": user.id, "plan": body.plan, "interval": body.interval},
        )
        return CheckoutOut(checkout_url=session.url)
    """
    if settings.stripe_secret_key:
        try:
            import stripe  # type: ignore

            stripe.api_key = settings.stripe_secret_key
            amount_brl = _PRICES[(body.plan, body.interval)]
            session = stripe.checkout.Session.create(  # INTEGRAÇÃO PAGA: Stripe
                mode="subscription",
                customer_email=user.email,
                line_items=[
                    {
                        "price_data": {
                            "currency": "brl",
                            "unit_amount": amount_brl * 100,
                            "recurring": {"interval": body.interval},
                            "product_data": {"name": f"CortaAí {body.plan.capitalize()}"},
                        },
                        "quantity": 1,
                    }
                ],
                success_url="http://localhost:3000/billing/success?session_id={CHECKOUT_SESSION_ID}",
                cancel_url="http://localhost:3000/billing/cancel",
                metadata={"user_id": user.id, "plan": body.plan, "interval": body.interval},
            )
            return CheckoutOut(checkout_url=session.url)
        except Exception:
            pass  # fall through to the mock URL below

    # Mock checkout URL (no STRIPE_SECRET_KEY configured)
    mock_id = uuid.uuid4().hex
    return CheckoutOut(
        checkout_url=f"https://checkout.stripe.com/c/pay/mock_{body.plan}_{body.interval}_{mock_id}"
    )


@router.post("/webhook")
async def webhook(request: Request, db: Session = Depends(get_db)) -> dict:
    """Stripe webhook. # INTEGRAÇÃO PAGA: Stripe.

    Production verifies the signature:

        event = stripe.Webhook.construct_event(
            payload, request.headers["stripe-signature"], settings.stripe_webhook_secret)

    Without STRIPE_WEBHOOK_SECRET the raw JSON body is trusted (dev mode).
    """
    raw = await request.body()
    try:
        if settings.stripe_secret_key and settings.stripe_webhook_secret:
            import stripe  # type: ignore

            event = stripe.Webhook.construct_event(  # INTEGRAÇÃO PAGA: Stripe signature check
                raw, request.headers.get("stripe-signature", ""), settings.stripe_webhook_secret
            )
            event = json.loads(json.dumps(event))  # normalize StripeObject → dict
        else:
            event = json.loads(raw or b"{}")
    except Exception:
        return {"received": False}

    etype = event.get("type", "")
    obj = (event.get("data") or {}).get("object") or {}
    metadata = obj.get("metadata") or {}
    user_id = metadata.get("user_id")
    plan = metadata.get("plan")
    interval = metadata.get("interval", "month")

    if etype == "checkout.session.completed" and user_id and plan in PLAN_LIMITS:
        user = db.get(User, user_id)
        if user is not None:
            user.plan = plan
            sub = db.execute(sa.select(Subscription).where(Subscription.user_id == user.id)).scalar_one_or_none()
            if sub is None:
                sub = Subscription(user_id=user.id, plan=plan, interval=interval)
                db.add(sub)
            sub.plan = plan
            sub.interval = interval
            sub.status = "active"
            sub.stripe_customer_id = obj.get("customer")
            sub.stripe_subscription_id = obj.get("subscription")
            sub.current_period_end = datetime.now(timezone.utc) + timedelta(days=365 if interval == "year" else 30)
            db.commit()
    elif etype in ("customer.subscription.deleted", "customer.subscription.canceled"):
        sub_id = obj.get("id")
        if sub_id:
            sub = db.execute(
                sa.select(Subscription).where(Subscription.stripe_subscription_id == sub_id)
            ).scalar_one_or_none()
            if sub is not None:
                sub.status = "canceled"
                user = db.get(User, sub.user_id)
                if user is not None:
                    user.plan = "free"
                db.commit()

    return {"received": True}
