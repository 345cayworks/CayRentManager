import { describe, expect, it } from 'vitest';
import { buildToastFromSearchParams } from '@/lib/ui/toast';

describe('buildToastFromSearchParams', () => {
  it('returns null when neither notice nor error is present', () => {
    expect(buildToastFromSearchParams(new URLSearchParams())).toBeNull();
    expect(buildToastFromSearchParams({})).toBeNull();
  });

  it('returns a success toast for notice', () => {
    expect(buildToastFromSearchParams({ notice: 'Saved' })).toEqual({
      tone: 'success',
      message: 'Saved',
    });
  });

  it('returns an error toast for error', () => {
    expect(buildToastFromSearchParams({ error: 'Bad input' })).toEqual({
      tone: 'error',
      message: 'Bad input',
    });
  });

  it('prefers error over notice when both are present', () => {
    expect(
      buildToastFromSearchParams({ notice: 'Saved', error: 'Failed' }),
    ).toEqual({ tone: 'error', message: 'Failed' });
  });

  it('ignores empty/whitespace values', () => {
    expect(buildToastFromSearchParams({ notice: '   ' })).toBeNull();
    expect(buildToastFromSearchParams({ error: '' })).toBeNull();
  });

  it('reads from URLSearchParams instances', () => {
    const params = new URLSearchParams('notice=Profile%20updated');
    expect(buildToastFromSearchParams(params)).toEqual({
      tone: 'success',
      message: 'Profile updated',
    });
  });

  it('takes the first value for array-style params', () => {
    expect(
      buildToastFromSearchParams({ notice: ['One', 'Two'] }),
    ).toEqual({ tone: 'success', message: 'One' });
  });
});
