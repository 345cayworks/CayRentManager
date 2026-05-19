# Billing Phase 4 — Fygaro webhook hardening + payment idempotency

Security-critical, focused scope. Phase 4 fixes two verified defects in the
Fygaro payment-confirmation path. It does not touch billing enforcement,
access codes, registration, or cron.

## Defects fixed

1. **Insecure "no secret ⇒ accept" default.**
   `verifyFygaroWebhookSignature` previously returned `true` when
   `FYGARO_WEBHOOK_SECRET` was unset — accepting *any* unsigned webhook and
   letting an attacker mark arbitrary invoices paid. It now **fails closed**.

2. **Non-idempotent payment application.**
   `markSubscriptionPaid` unconditionally set the invoice PAID and extended
   the subscription on *every* call, so a Fygaro retry / duplicate webhook
   double-extended the subscription. It is now idempotent.

## Fail-closed posture

- `FYGARO_WEBHOOK_SECRET` is **mandatory** for webhook-confirmed payments.
- When it is **unset or empty**, `verifyFygaroWebhookSignature` always returns
  `false`. There is **no path** by which an unsigned or invalid webhook is
  accepted. The route logs
  `[fygaro-webhook] FYGARO_WEBHOOK_SECRET not configured — rejecting webhook`
  (no secrets/signatures are ever logged) and returns `401`.
- Until the operator sets the secret, payment confirmation falls back to the
  existing SuperAdmin **manual mark-paid** flow. That is the correct secure
  default — webhooks are rejected rather than trusted blindly.

## Assumed signature scheme(s)

`verifyFygaroWebhookSignature(payloadRaw, signature?)` accepts, all
constant-time and never throwing:

1. **HMAC-SHA256** of the raw request body keyed with
   `FYGARO_WEBHOOK_SECRET`, sent as a `hex`, `base64`, or `base64url` digest
   in the `FYGARO_SIGNATURE_HEADER` header (`x-fygaro-signature`).
2. **HS256 JWT** (`xxx.yyy.zzz`) in the header or as the raw body, verified
   with `FYGARO_WEBHOOK_SECRET` (fallback `FYGARO_SECRET_KEY`), validating
   `exp` / `nbf` when present (exposed as `verifyFygaroJwt`).

The header name is single-sourced as the exported constant
`FYGARO_SIGNATURE_HEADER` and imported by the route (no hardcoded string).

> **OPERATOR ACTION REQUIRED.** These schemes are best-effort assumptions.
> Confirm Fygaro's **real** webhook signing scheme and header name against the
> Fygaro dashboard. If they differ, adjust `FYGARO_SIGNATURE_HEADER` and/or
> the algorithm in `src/lib/billing/fygaro.ts`, and set
> `FYGARO_WEBHOOK_SECRET` in the Netlify dashboard.

## Idempotency guarantee

`markSubscriptionPaid` re-loads the invoice and:

- If it is **already PAID**, it records a best-effort
  `BillingPaymentEvent` of type `duplicate_webhook_ignored` and returns
  **without** extending the subscription or changing user/subscription status.
- The genuine **first** PAID transition is claimed with a conditional
  `updateMany({ where: { id, status: { not: PAID } } })` inside the
  transaction; `count === 0` (a concurrent webhook won the race) is treated as
  an idempotent no-op.
- Only that genuine first transition runs the Phase 1 interval/extension
  math, sets the subscription/user ACTIVE, writes the audit + `payment_confirmed`
  event, and triggers the Phase 3 first-paid **referrer payout** (guarded by
  `appliedAsFirstPayment`, so retried/duplicate webhooks never re-pay a
  referrer).

Net result: a duplicate or retried Fygaro webhook will not double-extend the
subscription or double-pay a referrer; the genuine first-payment flow is
unchanged.

## Files

- `src/lib/billing/fygaro.ts` — fail-closed verifier, HMAC + JWT schemes,
  `FYGARO_SIGNATURE_HEADER`, `verifyFygaroJwt`.
- `src/lib/billing/subscriptions.ts` — idempotent `markSubscriptionPaid` +
  pure `isInvoiceAlreadyPaid` helper.
- `src/app/api/billing/fygaro/webhook/route.ts` — uses the shared header,
  warns + 401s when the secret is missing.
- `tests/fygaro-webhook.test.ts` — verifier / JWT / idempotency-decision
  coverage incl. the no-secret fail-closed case.
