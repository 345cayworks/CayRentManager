export type ThreadMessage = {
  id: string;
  senderId: string;
  receiverId: string;
  readAt: Date | null;
  createdAt: Date;
};

/** Unread = messages where receiverId === viewerUserId and readAt is null. */
export function unreadCount(messages: ThreadMessage[], viewerUserId: string): number {
  let count = 0;
  for (const message of messages) {
    if (message.receiverId === viewerUserId && message.readAt === null) count += 1;
  }
  return count;
}

/** Sort messages oldest→newest, stable. */
export function sortChronological<T extends { createdAt: Date }>(messages: T[]): T[] {
  return messages
    .map((message, index) => ({ message, index }))
    .sort((a, b) => {
      const diff = a.message.createdAt.getTime() - b.message.createdAt.getTime();
      return diff !== 0 ? diff : a.index - b.index;
    })
    .map((entry) => entry.message);
}

/** Group landlord-inbox messages by the non-landlord participant (tenant OR vendor).
 * landlordUserIds = the set of user ids on the landlord side (owner + active memberships).
 * The "other party" of each message is whichever of sender/receiver is NOT in landlordUserIds.
 * Returns entries with unread = messages whose receiver is a landlord-side user and readAt
 * is null. Inbox list sorted by lastAt desc. */
export function groupLandlordInbox(
  messages: ThreadMessage[],
  landlordUserIds: Set<string>,
): Array<{ participantUserId: string; messages: ThreadMessage[]; lastAt: Date; unreadForLandlord: number }> {
  const grouped = new Map<string, ThreadMessage[]>();

  for (const message of messages) {
    const senderIsLandlord = landlordUserIds.has(message.senderId);
    const receiverIsLandlord = landlordUserIds.has(message.receiverId);
    let participantUserId: string | null = null;
    if (!senderIsLandlord) participantUserId = message.senderId;
    else if (!receiverIsLandlord) participantUserId = message.receiverId;
    if (!participantUserId) continue;

    const existing = grouped.get(participantUserId);
    if (existing) existing.push(message);
    else grouped.set(participantUserId, [message]);
  }

  const result: Array<{
    participantUserId: string;
    messages: ThreadMessage[];
    lastAt: Date;
    unreadForLandlord: number;
  }> = [];

  for (const [participantUserId, threadMessages] of grouped) {
    const ordered = sortChronological(threadMessages);
    let lastAt = ordered[0].createdAt;
    let unreadForLandlord = 0;
    for (const message of ordered) {
      if (message.createdAt.getTime() > lastAt.getTime()) lastAt = message.createdAt;
      if (landlordUserIds.has(message.receiverId) && message.readAt === null) {
        unreadForLandlord += 1;
      }
    }
    result.push({ participantUserId, messages: ordered, lastAt, unreadForLandlord });
  }

  result.sort((a, b) => b.lastAt.getTime() - a.lastAt.getTime());
  return result;
}

export type ParticipantRef =
  | { kind: 'TENANT'; id: string; name: string; userId: string }
  | { kind: 'VENDOR'; id: string; name: string; userId: string };

/** Resolve a participant userId to a tenant (preferred) or vendor ref. */
export function resolveParticipant(
  participantUserId: string,
  tenantsByUserId: Map<string, { id: string; fullName: string }>,
  vendorsByUserId: Map<string, { id: string; name: string }>,
): ParticipantRef | null {
  const t = tenantsByUserId.get(participantUserId);
  if (t) return { kind: 'TENANT', id: t.id, name: t.fullName, userId: participantUserId };
  const v = vendorsByUserId.get(participantUserId);
  if (v) return { kind: 'VENDOR', id: v.id, name: v.name, userId: participantUserId };
  return null;
}
