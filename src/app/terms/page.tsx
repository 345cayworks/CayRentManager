import Link from 'next/link';

export const metadata = {
  title: 'Terms of Service · CayRentManager',
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      <div className="mt-2 space-y-3 text-sm leading-6 text-slate-600">{children}</div>
    </section>
  );
}

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-slate-50 p-6 sm:p-10">
      <div className="mx-auto max-w-3xl rounded-xl border bg-white p-6 shadow-sm sm:p-10">
        <Link href="/" className="text-sm font-semibold text-brand-navy">
          CayRentManager
        </Link>
        <h1 className="mt-4 text-2xl font-bold text-slate-900">Terms of Service</h1>
        <p className="mt-2 inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
          Draft — review by counsel before public launch
        </p>
        <p className="mt-4 text-sm text-slate-600">
          These terms govern use of the CayRentManager property-operations
          platform (the &ldquo;Service&rdquo;) by landlords, property managers,
          accountants, vendors, and tenants in the Cayman Islands and elsewhere.
        </p>

        <Section title="1. Acceptable use">
          <p>
            You agree to use the Service only for lawful property-management
            purposes and to keep your account credentials secure. You may not
            attempt to access workspaces, tenant data, or vendor data that you
            are not authorized to access, nor probe, scan, or disrupt the
            platform.
          </p>
        </Section>

        <Section title="2. Accounts and workspaces">
          <p>
            Each landlord workspace is isolated. Workspace owners are
            responsible for the users they invite (property managers,
            accountants, tenants, vendors) and for the accuracy of the records
            they enter, including leases, rent ledgers, and maintenance history.
          </p>
        </Section>

        <Section title="3. Payment terms">
          <p>
            Subscription and, where enabled, rent or invoice payments are
            processed through our third-party payment provider, Fygaro. Payment
            card data is handled by the provider and is not stored by
            CayRentManager. You are responsible for any fees, taxes (including
            Cayman tourist-accommodation tax where applicable), and chargebacks
            associated with your account.
          </p>
        </Section>

        <Section title="4. Vendor and tenant data">
          <p>
            You must have a lawful basis to upload tenant and vendor
            information, documents, and photos. You are responsible for
            obtaining any necessary consents and for honoring data-subject
            requests relating to records you control within your workspace.
          </p>
        </Section>

        <Section title="5. Service availability and beta status">
          <p>
            The Service is offered during a public beta. Features may change,
            and the Service is provided &ldquo;as is&rdquo; without warranties
            of any kind. We aim for high availability but do not guarantee
            uninterrupted operation.
          </p>
        </Section>

        <Section title="6. Limitation of liability">
          <p>
            To the maximum extent permitted by law, CayRentManager is not liable
            for indirect, incidental, or consequential damages, or for loss of
            data, revenue, or profits arising from use of the Service. Maintain
            your own backups of critical records.
          </p>
        </Section>

        <Section title="7. Termination">
          <p>
            We may suspend or terminate access for breach of these terms.
            You may stop using the Service at any time; export critical records
            before deactivating an account.
          </p>
        </Section>

        <Section title="8. Contact">
          <p>
            Questions about these terms can be directed to the workspace
            administrator or the CayRentManager operator contact provided at
            onboarding.
          </p>
        </Section>

        <div className="mt-10 flex flex-wrap gap-4 text-sm">
          <Link href="/privacy" className="text-brand-navy hover:underline">
            Privacy Policy
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
