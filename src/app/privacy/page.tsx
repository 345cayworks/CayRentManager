import Link from 'next/link';

export const metadata = {
  title: 'Privacy Policy · CayRentManager',
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
    <main className="min-h-screen bg-slate-50 p-6 sm:p-10">
      <div className="mx-auto max-w-3xl rounded-xl border bg-white p-6 shadow-sm sm:p-10">
        <Link href="/" className="text-sm font-semibold text-brand-navy">
          CayRentManager
        </Link>
        <h1 className="mt-4 text-2xl font-bold text-slate-900">Privacy Policy</h1>
        <p className="mt-2 inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
          Draft — review by counsel before public launch
        </p>
        <p className="mt-4 text-sm text-slate-600">
          This policy explains how CayRentManager handles data for a
          Cayman-focused property-operations platform.
        </p>

        <Section title="1. Data we collect">
          <p>
            Account data (name, email, role), workspace records you enter
            (properties, units, leases, tenants, vendors, rent ledgers,
            maintenance requests), uploaded documents and photos, and standard
            technical logs needed to operate and secure the Service.
          </p>
        </Section>

        <Section title="2. How data is used">
          <p>
            Data is used to provide the Service: rendering workspaces, sending
            notifications you configure (email/SMS/WhatsApp), processing
            payments via Fygaro, and maintaining audit and security records.
          </p>
        </Section>

        <Section title="3. Storage and processors">
          <p>
            The platform is hosted on Netlify. Structured data is stored in a
            managed Postgres database; documents and photos are stored in
            Netlify Blobs. Payment processing is handled by Fygaro; optional
            messaging uses Resend (email) and Twilio (SMS/WhatsApp). Each
            processor handles data under its own terms.
          </p>
        </Section>

        <Section title="4. Workspace isolation">
          <p>
            Records are scoped to the landlord workspace that owns them.
            Tenants and vendors see only the data shared with them through their
            portal.
          </p>
        </Section>

        <Section title="5. Retention and deletion">
          <p>
            Records persist for as long as the workspace is active. Workspace
            administrators can archive or remove records; deletion of stored
            documents and photos removes the underlying blob. Backups may retain
            data for a limited period before rotation.
          </p>
        </Section>

        <Section title="6. Your choices">
          <p>
            You can update profile data, manage notification preferences, and
            request export or deletion of records through your workspace
            administrator. Data-subject requests for tenant/vendor data should
            be directed to the controlling workspace.
          </p>
        </Section>

        <Section title="7. Contact">
          <p>
            Privacy questions can be directed to the workspace administrator or
            the CayRentManager operator contact provided at onboarding.
          </p>
        </Section>

        <div className="mt-10 flex flex-wrap gap-4 text-sm">
          <Link href="/terms" className="text-brand-navy hover:underline">
            Terms of Service
          </Link>
          <Link href="/login" className="text-brand-navy hover:underline">
            Sign in
          </Link>
          <Link href="/" className="text-brand-navy hover:underline">
            Home
          </Link>
        </div>
      </div>
    </main>
  );
}
