import { describe, expect, it } from 'vitest';
import {
  groupLandlordInbox,
  sortChronological,
  unreadCount,
  type ThreadMessage,
} from '@/lib/messaging/threads';

function msg(overrides: Partial<ThreadMessage>): ThreadMessage {
  return {
    id: 'm',
    senderId: 's',
    receiverId: 'r',
    readAt: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

describe('unreadCount', () => {
  it('counts only messages received by the viewer with null readAt', () => {
    const messages = [
      msg({ id: '1', receiverId: 'viewer', readAt: null }),
      msg({ id: '2', receiverId: 'viewer', readAt: null }),
      msg({ id: '3', receiverId: 'viewer', readAt: new Date() }),
      msg({ id: '4', receiverId: 'other', readAt: null }),
    ];
    expect(unreadCount(messages, 'viewer')).toBe(2);
  });

  it('returns zero when none unread', () => {
    expect(unreadCount([], 'viewer')).toBe(0);
    expect(unreadCount([msg({ receiverId: 'viewer', readAt: new Date() })], 'viewer')).toBe(0);
  });

  it('ignores read messages', () => {
    const messages = [msg({ receiverId: 'viewer', readAt: new Date() })];
    expect(unreadCount(messages, 'viewer')).toBe(0);
  });
});

describe('sortChronological', () => {
  it('sorts ascending by createdAt', () => {
    const messages = [
      { id: 'b', createdAt: new Date('2026-01-03T00:00:00Z') },
      { id: 'a', createdAt: new Date('2026-01-01T00:00:00Z') },
      { id: 'c', createdAt: new Date('2026-01-02T00:00:00Z') },
    ];
    expect(sortChronological(messages).map((m) => m.id)).toEqual(['a', 'c', 'b']);
  });

  it('is stable for equal timestamps', () => {
    const t = new Date('2026-01-01T00:00:00Z');
    const messages = [
      { id: 'x', createdAt: t },
      { id: 'y', createdAt: t },
      { id: 'z', createdAt: t },
    ];
    expect(sortChronological(messages).map((m) => m.id)).toEqual(['x', 'y', 'z']);
  });
});

describe('groupLandlordInbox', () => {
  const landlord = new Set(['owner', 'manager']);

  it('groups by the non-landlord party and counts unread received by landlord', () => {
    const messages: ThreadMessage[] = [
      msg({ id: '1', senderId: 'tenantA', receiverId: 'owner', readAt: null, createdAt: new Date('2026-01-01T00:00:00Z') }),
      msg({ id: '2', senderId: 'owner', receiverId: 'tenantA', readAt: null, createdAt: new Date('2026-01-02T00:00:00Z') }),
      msg({ id: '3', senderId: 'tenantA', receiverId: 'manager', readAt: new Date(), createdAt: new Date('2026-01-03T00:00:00Z') }),
      msg({ id: '4', senderId: 'tenantB', receiverId: 'owner', readAt: null, createdAt: new Date('2026-01-05T00:00:00Z') }),
    ];

    const groups = groupLandlordInbox(messages, landlord);
    expect(groups.map((g) => g.tenantUserId)).toEqual(['tenantB', 'tenantA']);

    const a = groups.find((g) => g.tenantUserId === 'tenantA')!;
    expect(a.messages).toHaveLength(3);
    expect(a.unreadForLandlord).toBe(1);
    expect(a.lastAt).toEqual(new Date('2026-01-03T00:00:00Z'));

    const b = groups.find((g) => g.tenantUserId === 'tenantB')!;
    expect(b.unreadForLandlord).toBe(1);
  });

  it('groups under the tenant even when landlord is sender only', () => {
    const messages: ThreadMessage[] = [
      msg({ id: '1', senderId: 'owner', receiverId: 'tenantC', readAt: null }),
    ];
    const groups = groupLandlordInbox(messages, landlord);
    expect(groups).toHaveLength(1);
    expect(groups[0].tenantUserId).toBe('tenantC');
    expect(groups[0].unreadForLandlord).toBe(0);
  });

  it('sorts inbox by lastAt descending', () => {
    const messages: ThreadMessage[] = [
      msg({ id: '1', senderId: 'tenantOld', receiverId: 'owner', createdAt: new Date('2026-01-01T00:00:00Z') }),
      msg({ id: '2', senderId: 'tenantNew', receiverId: 'owner', createdAt: new Date('2026-02-01T00:00:00Z') }),
    ];
    const groups = groupLandlordInbox(messages, landlord);
    expect(groups.map((g) => g.tenantUserId)).toEqual(['tenantNew', 'tenantOld']);
  });
});
