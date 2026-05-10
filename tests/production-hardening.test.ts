import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

describe('production hardening guardrails', () => {
  it('protects the temporary owner bootstrap route with a non-public secret', () => {
    const route = read('src/app/api/debug/bootstrap-owner/route.ts');

    expect(route).toContain('OWNER_BOOTSTRAP_SECRET');
    expect(route).toContain("searchParams.get('secret')");
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

  it('keeps shell navigation role-aware and hides unfinished workflow links', () => {
    const shell = read('src/components/shell.tsx');

    expect(shell).toContain('linksForRole');
    expect(shell).toContain('UserRole.SUPERADMIN');
    expect(shell).toContain('UserRole.TENANT');
    expect(shell).not.toContain("'/maintenance'");
    expect(shell).not.toContain("'/documents'");
    expect(shell).not.toContain("'/reports'");
    expect(shell).not.toContain("'/settings'");
  });

  it('guards dangerous admin role transitions', () => {
    const actions = read('src/server/actions.ts');

    expect(actions).toContain('You cannot remove the only active superadmin.');
    expect(actions).toContain('Assign the TENANT role only after a tenant profile exists.');
    expect(actions).toContain('Assign a landlord workspace membership before assigning this role.');
    expect(actions).toContain('previousRole');
  });
});
