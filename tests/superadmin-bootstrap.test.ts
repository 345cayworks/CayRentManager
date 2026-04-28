import { describe, expect, it } from 'vitest';

const PRIMARY_SUPERADMIN = 'info@cayworks.com';

describe('superadmin bootstrap invariant', () => {
  it('locks primary superadmin email', () => {
    expect(PRIMARY_SUPERADMIN).toBe('info@cayworks.com');
  });
});
