import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('superadmin bootstrap invariant', () => {
  it('uses SUPER_ADMIN_EMAIL for owner bootstrap source of truth', () => {
    const sync = fs.readFileSync(path.join(process.cwd(), 'src/lib/identity/sync.ts'), 'utf8');
    const route = fs.readFileSync(path.join(process.cwd(), 'src/app/api/admin/bootstrap-owner/route.ts'), 'utf8');

    expect(sync).toContain('process.env.SUPER_ADMIN_EMAIL');
    expect(route).toContain('process.env.SUPER_ADMIN_EMAIL');
  });
});
