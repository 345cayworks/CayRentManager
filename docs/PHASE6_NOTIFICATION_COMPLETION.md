# Phase 6 — Notification Infrastructure Completion

This document records the two final Phase 6 pieces shipped on top of the
Phase 4 alert/notification foundation: the **escalation rules engine** (with
team-member resolution) and the **SMS/WhatsApp-ready channel abstraction**.

## What shipped

- `EscalationPolicy` (per-workspace, `landlordId` unique) and `AlertEscalation`
  (idempotency ledger, unique on `landlordId+alertKey+level`) models +
  idempotent migration `20260516000100_phase6-escalation`.
- `NotificationChannel` enum gained `WHATSAPP`. `OutboundNotification` gained
  `recipientPhone` and `notificationKind` (`GENERAL` | `DIGEST` |
  `ESCALATION`, kept as a plain string to avoid enum churn).
- Pure, unit-tested escalation engine in `src/lib/notifications/escalation.ts`:
  `resolveEscalationPolicy`, `evaluateEscalation`, `selectEscalationRecipients`.
- Single-alert escalation message builder
  `src/lib/notifications/escalation-message.ts` (reuses the digest dark-header
  HTML style; plaintext is short and self-contained for SMS/WhatsApp).
- Outbox generalized to a per-channel driver registry without changing email
  behaviour; new `queueNotification`, `selectChannelProvider`, and
  `queueEmailNotification` now delegates to `queueNotification`.
- Hourly scheduled function `netlify/functions/alert-escalation-scan.ts`.
- Platform escalation defaults via `src/lib/settings/platform.ts`
  (`getEscalationDefaults`, widened `setPlatformSetting` key union — existing
  `timezone`/`currency` callers unchanged).
- UI: escalation policy form on `/account/notifications`, escalation defaults
  form on `/admin/settings`, and an "Escalated" pill on the alert center list.

## Escalation model + level math

A snapshot escalates when ALL hold:

1. policy `enabled` is true (workspace row, else platform defaults, else hard
   defaults — layered by `resolveEscalationPolicy`);
2. snapshot severity rank `>=` policy `minSeverity` rank (unknown severity is
   treated as `INFO`);
3. age `= (now - firstSeenAt)` in hours `>= thresholdHours`
   (`firstSeenAt` is the age anchor and is never bumped on re-scan);
4. the computed level is greater than the highest level already recorded in
   `AlertEscalation` for that `landlordId+alertKey`.

Level math:

- Without `repeatHours`: escalate once → `level = 1`.
- With `repeatHours`: `level = 1 + floor((age - thresholdHours) / repeatHours)`
  once `age >= thresholdHours`; escalate iff `level > highestSentLevel`.

The `@@unique([landlordId, alertKey, level])` constraint guarantees each level
is sent once even under concurrent scans; the scan catches the Prisma `P2002`
unique violation and continues.

Recipients are resolved from `LandlordMembership` rows filtered by
`policy.notifyRoles`, deduped by `userId`, dropping inactive memberships /
inactive users / empty emails. A null phone is kept; the scan skips SMS and
WhatsApp queueing for recipients without a phone (no guaranteed-FAIL rows).

## Channel driver matrix + required env vars

| Channel  | Provider when configured | Fallback | Required env |
|----------|--------------------------|----------|--------------|
| EMAIL    | `resend`                 | `log`    | `NOTIFICATION_PROVIDER=resend`, `RESEND_API_KEY`, `NOTIFICATION_FROM_EMAIL` (+ optional `NOTIFICATION_FROM_NAME`) |
| SMS      | `twilio`                 | `log`    | `SMS_PROVIDER=twilio`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_SMS_FROM` |
| WHATSAPP | `twilio`                 | `log`    | `WHATSAPP_PROVIDER=twilio`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM` |

Twilio uses the REST endpoint
`POST https://api.twilio.com/2010-04-01/Accounts/{SID}/Messages.json` with
HTTP Basic auth and form-encoded `To`/`From`/`Body`, parsing `sid` as the
provider message id (no SDK dependency — plain `fetch`, mirroring the Resend
driver). WhatsApp prefixes `whatsapp:` on both `To` and `From`. SMS/WhatsApp
sends strip HTML and use the plaintext body only.

`selectChannelProvider(channel, env)` is a pure function (env-like map in,
provider string out) and is unit-tested in `tests/notification-channels.test.ts`.

## The hourly scan

`alert-escalation-scan.ts` (`schedule: '0 * * * *'`) mirrors
`alert-digest-daily.ts` structure/error handling. Per ACTIVE landlord it loads
the policy (+ platform defaults), skips when disabled, loads ACTIVE snapshots
with `reviewedAt IS NULL`, resolves recipients, evaluates each snapshot,
queues per-recipient per-channel notifications, records one `AlertEscalation`
row per level, then drains the outbox via `processOutboundNotifications` and
returns a JSON summary.

## Tests

- `tests/notification-escalation.test.ts` — policy resolution layering,
  escalation decision (threshold, severity gate, disabled, repeat cadence
  L1/L2/L3, level suppression), recipient role filtering / dedupe / drops.
- `tests/notification-channels.test.ts` — `selectChannelProvider` for
  EMAIL/SMS/WHATSAPP configured vs. fallback and unknown channel.

Full suite: 209 passing (192 prior + 17 new). `tsc --noEmit` adds zero new
errors (the ~13 pre-existing `tests/finance-metrics.test.ts` errors are
unrelated and untouched).

## Deferred / skipped notes

- Alert-center "Escalated" pill: implemented (one extra keyed query +
  `Set` lookup + a small span — within the size budget).
- Notification retry/backoff for FAILED rows remains future work (Phase 4
  outbox lifecycle is unchanged: `PENDING → SENT / FAILED / SKIPPED`).
- No SMS/WhatsApp SDK added; Twilio is called via `fetch` only.
