# Netlify Identity Email Confirmation

## Root cause

Netlify Identity's default confirmation email lands the user on the site
root `/` with a `#confirmation_token=...` fragment. `handleAuthCallback()`
(invoked via `initializeIdentity()`) only ran inside the auth forms on
`/login`, `/register`, and `/invite/[token]`. On the marketing root no
callback handler ran, nothing stripped or processed the token, and the user
was never confirmed. The fragment is client-only, so no redirect rule or
middleware could observe it.

## The fix

1. **Global hash forwarder** — `src/components/auth/identity-hash-handler.tsx`
   is a `'use client'` component that renders `null`. Mounted globally in
   `src/app/layout.tsx`, it runs on every route including `/`. On mount, if
   `window.location.hash` contains an Identity token
   (`confirmation_token`, `invite_token`, `recovery_token`,
   `email_change_token`) and the path is not already `/auth/callback`, it
   does `window.location.replace('/auth/callback' + hash)`. A same-origin
   location replace is used (not the Next router) so the fragment is
   preserved.
2. **Callback page** — `src/app/auth/callback/page.tsx` is a self-contained
   `'use client'` page. It captures the hash, calls the existing
   `initializeIdentity()` (which runs `handleAuthCallback()`), and on
   success redirects:
   - `confirmation_token` / Netlify `invite_token` / unknown →
     `/login?confirmed=1`
   - `recovery_token` → `/reset-password`
   - `email_change_token` → `/login?email_changed=1`

   On failure it shows a clear error and clears the hash so a refresh does
   not loop. It uses `window.location` directly (no `useSearchParams`) to
   avoid a Next CSR-bailout build error.
3. **Login messaging** — `src/components/identity-auth-form.tsx` now tells
   newly registered users to confirm via email, and shows a success message
   on `/login?confirmed=1` and `/login?email_changed=1`.

This app's auth route is `/login` (there is no `/signin`); confirmation
success always lands on `/login?confirmed=1`.

## Netlify dashboard action (operator)

If custom Identity email templates are available on the plan, set the
template links so they point at the dedicated callback path:

- Confirmation: `{{ .SiteURL }}/auth/callback/#confirmation_token={{ .Token }}`
- Recovery: `{{ .SiteURL }}/auth/callback/#recovery_token={{ .Token }}`
- Invite: `{{ .SiteURL }}/auth/callback/#invite_token={{ .Token }}`
- Email change: `{{ .SiteURL }}/auth/callback/#email_change_token={{ .Token }}`

If custom templates are **not** available on the plan, no action is needed:
the global root-mounted hash handler already processes the default
`/#confirmation_token=...` landing.

## Production notes

- Must be served over HTTPS on the canonical domain
  (`NEXT_PUBLIC_APP_URL`).
- Netlify Identity must be enabled with email confirmation turned on.
- The `/auth/callback` route is intentionally **public** — it is not added
  to the `src/middleware.ts` matcher.

## Test checklist

- [ ] Create a test user via `/register`.
- [ ] Confirm the confirmation email arrives.
- [ ] Click the confirmation link (verify it lands on `/auth/callback` or
      `/#confirmation_token=...`).
- [ ] Confirm the user's status flips to confirmed in Netlify Identity →
      Users.
- [ ] Confirm redirect to `/login?confirmed=1` with the success message
      visible.
- [ ] Confirm sign-in works after confirmation.
