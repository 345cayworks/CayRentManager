# Backup & Recovery Runbook

Operational runbook for CayRentManager (Next.js 14 App Router + Prisma +
Postgres, deployed on Netlify with Netlify DB and Netlify Blobs). This is an
operations doc — no code changes are implied here.

## 1. Components that hold state

| Store | What lives there | Backup mechanism |
| --- | --- | --- |
| Netlify DB (managed Postgres) | All structured records: users, landlord workspaces, properties, units, leases, tenants, vendors, rent ledger, maintenance, audit log | Netlify DB automated snapshots + manual logical dumps |
| Netlify Blobs | Uploaded documents, property/unit photos, payment proof | Blob enumeration + export (see §3) |
| Environment variables | Secrets and config (per `.env.example`) | Recorded in a secure secrets manager, not in the repo |

## 2. Database backup & restore

### Backup

- **Managed:** Netlify DB provisions the Postgres instance and exposes it as
  `NETLIFY_DB_URL` (the managed fallback for `DATABASE_URL`). Use the database
  provider's console (Netlify DB / underlying Postgres provider) to confirm
  automated snapshot/PITR is enabled and to set retention.
- **Manual logical dump (recommended before risky migrations or releases):**

  ```
  pg_dump "$DATABASE_URL" --no-owner --format=custom --file=crm-$(date +%F).dump
  ```

  Store the dump in encrypted, off-platform storage. Keep at least the last
  7 daily + 4 weekly dumps.

### Restore

1. Provision/identify the target database and set `DATABASE_URL`
   (or rely on `NETLIFY_DB_URL` on Netlify).
2. Restore the dump:

   ```
   pg_restore --no-owner --clean --if-exists --dbname "$DATABASE_URL" crm-YYYY-MM-DD.dump
   ```

3. Run migrations to reconcile schema (see §4):

   ```
   npx prisma migrate deploy
   ```

4. Validate with the health endpoint (`/api/health`) and a smoke pass (§ Public
   Beta Checklist).

## 3. Netlify Blobs durability & export

- Netlify Blobs is auto-provisioned on Netlify; no env var is required. It is
  the durable store for documents and photos. Blob keys are derived from the
  storage-key helpers (`src/lib/**` storage-key logic; covered by
  `tests/storage-keys.test.ts`).
- **Durability:** Blobs are replicated by Netlify. Treat the DB row as the
  index of record — every stored document/photo has a DB row referencing its
  blob key. A blob without a DB row is orphaned; a DB row whose blob is missing
  surfaces in the app as a "broken" placeholder (removable from the Documents
  page).
- **Enumerate / export:** Use the Netlify Blobs API/CLI for the site's store(s)
  to list keys, then stream each key to off-platform encrypted storage. Cross-
  check the exported key set against the document/photo tables so the export is
  complete. Schedule this alongside the DB dump so blob + DB snapshots are
  time-aligned.
- **Restore:** Re-upload blobs under their original keys, then restore the DB
  dump so rows and blob keys line up again.

## 4. Migration model (dual pattern)

CayRentManager intentionally maintains two artifacts that must stay in sync
(see `docs/MIGRATION_DISCIPLINE.md`):

- `prisma/schema.prisma` — the Prisma schema / client source of truth.
- `netlify/database/migrations` — the SQL migrations applied to Netlify DB.

Rules:

- A schema change requires a corresponding migration. This sprint is
  schema-free (no migration added).
- On restore, after loading data, run `npx prisma migrate deploy` so the
  restored DB matches the committed migration history, then
  `npx prisma generate`.
- Never hand-edit a production DB to "match" the schema — write a migration.

## 5. Secret rotation

Rotate via the secrets manager and Netlify environment variables. Rotation
order matters for zero/low-downtime:

| Secret | Effect of rotation | Notes |
| --- | --- | --- |
| `APP_SESSION_SECRET` | Invalidates all active app sessions (users must sign in again) | Rotate during a low-traffic window; communicate forced re-login |
| `SUPERADMIN_MASTER_KEY` | Break-glass key only | Rotate immediately if exposed; never expose publicly |
| `FYGARO_SECRET_KEY` / `FYGARO_WEBHOOK_SECRET` / `FYGARO_KID` / `FYGARO_PUBLIC_KEY` | New keys must be issued in Fygaro first, then updated here; webhook secret mismatch rejects callbacks | Update Fygaro dashboard and env together |
| `TWILIO_AUTH_TOKEN` (+ SID) | SMS/WhatsApp sends fail until updated | Rotate in Twilio, then env |
| `RESEND_API_KEY` | Email sends fail until updated | Rotate in Resend, then env |

After any rotation: redeploy (so the new env is picked up) and verify the
relevant flow (sign-in, a test payment webhook, a test email/SMS).

## 6. Restore checklist

- [ ] Identify the incident scope (DB only, blobs only, or both) and the target
      recovery point.
- [ ] Freeze writes if feasible (maintenance mode / pause traffic).
- [ ] Restore DB dump to the target database.
- [ ] Run `npx prisma migrate deploy` then `npx prisma generate`.
- [ ] Restore blobs under original keys; reconcile blob keys against
      document/photo tables.
- [ ] Confirm env vars are set per `.env.example` (and
      `ENABLE_BOOTSTRAP_OWNER_ROUTE` unset/false).
- [ ] Hit `/api/health` — DB connectivity OK.
- [ ] Smoke: sign in, open a workspace, view a document/photo, run a test
      payment/notification path.
- [ ] Verify superadmin can reach the admin dashboard.
- [ ] Re-enable writes / lift maintenance mode.
- [ ] Record the incident, root cause, and recovery point achieved.
