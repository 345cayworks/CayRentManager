import Link from 'next/link';
import type { Metadata } from 'next';
import { SiteHeader } from '@/components/public/site-header';
import { SiteFooter } from '@/components/public/site-footer';

export const metadata: Metadata = {
  title: 'Privacy Policy · CayRentManager',
  description:
    'How CayRentManager handles account, workspace, document, and notification data for a Cayman-focused property-operations platform.',
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      <div className="mt-2 space-y-3 text-sm leading-6 text-slate-600">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white text-slate-900">
      <SiteHeader />
      <main className="flex-1 px-4 py-12 sm:px-6 sm:py-16">
        <div className="mx-auto max-w-3xl">
          <p className="text-xs font-medium uppercase tracking-wide text-cyan-700">
            Legal
          </p>
          <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
            Privacy Policy
          </h1>

          <div className="mt-8 rounded-xl border border-slate-200 bg-white p-6 sm:p-8">
            <p className="text-sm leading-6 text-slate-600">
              This policy explains how CayRentManager handles data for a
              Cayman-focused property-operations platform.
            </p>

            <Section title="1. Data we collect">
              <p>
                Account data (name, email, role), workspace records you enter
                (properties, units, leases, tenants, vendors, rent ledgers,
                maintenance requests), uploaded documents and photos, and
                standard technical logs needed to operate and secure the
                Service.
              </p>
            </Section>

            <Section title="2. How data is used">
              <p>
                Data is used to provide the Service: rendering workspaces,
                sending notifications you configure (email/SMS/WhatsApp),
                processing payments via Fygaro, and maintaining audit and
                security records.
              </p>
            </Section>

            <Section title="3. Storage and processors">
              <p>
                The platform is hosted on Netlify. Structured data is stored in
                a managed Postgres database; documents and photos are stored in
                Netlify Blobs. Payment processing is handled by Fygaro;
                optional messaging uses Resend (email) and Twilio (SMS/WhatsApp).
                Each processor handles data under its own terms.
              </p>
            </Section>

            <Section title="4. Workspace isolation">
              <p>
                Records are scoped to the landlord workspace that owns them.
                Tenants and vendors see only the data shared with them through
                their portal.
              </p>
            </Section>

            <Section title="5. Retention and deletion">
              <p>
                Records persist for as long as the workspace is active.
                Workspace administrators can archive or remove records;
                deletion of stored documents and photos removes the underlying
                blob. Backups may retain data for a limited period before
                rotation.
              </p>
            </Section>

            <Section title="6. Your choices">
              <p>
                You can update profile data, manage notification preferences,
                and request export or deletion of records through your
                workspace administrator. Data-subject requests for
                tenant/vendor data should be directed to the controlling
                workspace.
              </p>
            </Section>

            <Section title="7. Contact">
              <p>
                Privacy questions can be directed to the workspace
                administrator or the CayRentManager operator contact provided
                at onboarding.
              </p>
            </Section>
          </div>

          <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-sm">
            <Link
              href="/terms"
              className="text-slate-600 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600"
            >
              Terms of Service
            </Link>
            <Link
              href="/login"
              className="text-slate-600 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600"
            >
              Sign in
            </Link>
            <Link
              href="/"
              className="text-slate-600 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600"
            >
              Home
            </Link>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
