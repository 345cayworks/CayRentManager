import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

describe('Netlify Identity auth direction', () => {
  it('does not keep Auth.js runtime dependencies installed', () => {
    const pkg = JSON.parse(read('package.json')) as { dependencies?: Record<string, string> };

    expect(pkg.dependencies?.['next-auth']).toBeUndefined();
    expect(pkg.dependencies?.['@auth/prisma-adapter']).toBeUndefined();
    expect(pkg.dependencies?.['@netlify/identity']).toBeDefined();
  });

  it('documents the app session secret instead of Auth.js secrets', () => {
    const envExample = read('.env.example');

    expect(envExample).toContain('APP_SESSION_SECRET=');
    expect(envExample).not.toContain('NEXTAUTH_SECRET');
    expect(envExample).not.toContain('AUTH_SECRET');
  });

  it('uses only APP_SESSION_SECRET for the signed app session bridge', () => {
    const session = read('src/lib/auth/session.ts');

    expect(session).toContain('process.env.APP_SESSION_SECRET');
    expect(session).not.toContain('process.env.NEXTAUTH_SECRET');
    expect(session).not.toContain('process.env.AUTH_SECRET');
  });
});
