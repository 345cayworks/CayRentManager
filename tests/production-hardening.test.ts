import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

describe('production hardening guardrails', () => {
  it('removes the public debug bootstrap route and protects owner bootstrap with env master key', () => {
    const route = read('src/app/api/admin/bootstrap-owner/route.ts');

    expect(fs.existsSync(path.join(root, 'src/app/api/debug/bootstrap-owner/route.ts'))).toBe(false);
    expect(route).toContain('SUPER_ADMIN_EMAIL');
    expect(route).toContain('SUPERADMIN_MASTER_KEY');
    expect(route).toContain('masterKey');
    expect(route).toContain('timingSafeEqual');
    expect(route).not.toContain('GET(');
    expect(route).toContain('status: 403');
    expect(route).toContain('status: 404');
  });

  it('keeps safe health and identity status responses free of secrets', () => {
    const health = read('src/app/api/health/route.ts');
    const me = read('src/app/api/identity/me/route.ts');

    expect(health).toContain("app: 'ok'");
    expect(health).toContain('SELECT 1');
    expect(health).not.toContain('DATABASE_URL');
    expect(health).not.toContain('APP_SESSION_SECRET');

    expect(me).toContain('authenticated: false');
    expect(me).toContain('authenticated: true');
    expect(me).not.toContain('netlifyUserId');
    expect(me).not.toContain('token');
  });

  it('uses scoped updateMany for landlord lifecycle actions', () => {
    const actions = read('src/server/actions.ts');
    const unsafeScopedUpdates = actions
      .split('\n')
      .filter((line) => line.includes('update({') && line.includes('where:') && line.includes('id:') && line.includes('landlordId'));

    expect(actions).toContain('assertSingleWorkspaceUpdate');
    expect(unsafeScopedUpdates).toEqual([]);
  });

  it('keeps invite acceptance and public landlord registration transactional and idempotent', () => {
    const invitations = read('src/lib/services/invitations.ts');
    const registration = read('src/lib/services/registration.ts');

    expect(invitations).toContain('prisma.$transaction');
    expect(invitations).toContain('landlordId_email');
    expect(invitations).toContain('Email mismatch');

    expect(registration).toContain('prisma.$transaction');
    expect(registration).toContain('ownedLandlords');
    expect(registration).toContain('This account is disabled.');
  });

  it('does not use the old forbidden dashboard redirect path', () => {
    const files = [
      'src/lib/auth/guards.ts',
      'src/app/api/identity/session/route.ts',
      'src/components/identity-auth-form.tsx',
      'src/server/actions.ts',
    ];

    for (const file of files) {
      expect(read(file)).not.toContain('dashboard?error=forbidden');
    }
  });

  it('keeps shell navigation role-aware and isolates operational roles', () => {
    const shell = read('src/components/shell.tsx');

    // Navigation must dispatch by role, not be a flat link list.
    expect(shell).toContain('linksForRole');
    expect(shell).toContain('UserRole.SUPERADMIN');
    expect(shell).toContain('UserRole.TENANT');
    expect(shell).toContain('UserRole.LANDLORD');

    // Operational roles (vendor, maintenance provider, concierge, guest) must
    // route to /unauthorized rather than receive landlord or admin navigation.
    expect(shell).toContain('UserRole.VENDOR');
    expect(shell).toContain('UserRole.MAINTENANCE_PROVIDER');
    expect(shell).toContain('UserRole.CONCIERGE_AGENT');
    expect(shell).toContain('UserRole.GUEST');
    expect(shell).toContain("'/unauthorized'");

    // Tenant navigation must never include landlord-only routes.
    const tenantLinksMatch = shell.match(/const tenantLinks = \[([\s\S]*?)\];/);
    expect(tenantLinksMatch).not.toBeNull();
    const tenantLinksBlock = tenantLinksMatch![1];
    expect(tenantLinksBlock).not.toContain("'/properties'");
    expect(tenantLinksBlock).not.toContain("'/payments'");
    expect(tenantLinksBlock).not.toContain("'/expenses'");
    expect(tenantLinksBlock).not.toContain("'/reports'");
    expect(tenantLinksBlock).not.toContain("'/admin'");

    // Admin navigation must not bleed into landlord workspace routes.
    const adminLinksMatch = shell.match(/const adminLinks = \[([\s\S]*?)\];/);
    expect(adminLinksMatch).not.toBeNull();
    const adminLinksBlock = adminLinksMatch![1];
    expect(adminLinksBlock).not.toContain("'/properties'");
    expect(adminLinksBlock).not.toContain("'/dashboard'");
    expect(adminLinksBlock).not.toContain("'/tenant/");
  });

  it('guards dangerous admin role transitions', () => {
    const actions = read('src/server/actions.ts');

    expect(actions).toContain('You cannot remove the only active superadmin.');
    expect(actions).toContain('Assign the TENANT role only after a tenant profile exists.');
    expect(actions).toContain('Assign a landlord workspace membership before assigning this role.');
    expect(actions).toContain('previousRole');
  });
});
