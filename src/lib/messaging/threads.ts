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

/** Group landlord-inbox messages by the tenant participant.
 * landlordUserIds = the set of user ids on the landlord side (owner + active memberships).
 * The "other party" of each message is whichever of sender/receiver is NOT in landlordUserIds.
 * Returns entries with unread = messages whose receiver is a landlord-side user and readAt
 * is null. Inbox list sorted by lastAt desc. */
export function groupLandlordInbox(
  messages: ThreadMessage[],
  landlordUserIds: Set<string>,
): Array<{ tenantUserId: string; messages: ThreadMessage[]; lastAt: Date; unreadForLandlord: number }> {
  const grouped = new Map<string, ThreadMessage[]>();

  for (const message of messages) {
    const senderIsLandlord = landlordUserIds.has(message.senderId);
    const receiverIsLandlord = landlordUserIds.has(message.receiverId);
    let tenantUserId: string | null = null;
    if (!senderIsLandlord) tenantUserId = message.senderId;
    else if (!receiverIsLandlord) tenantUserId = message.receiverId;
    if (!tenantUserId) continue;

    const existing = grouped.get(tenantUserId);
    if (existing) existing.push(message);
    else grouped.set(tenantUserId, [message]);
  }

  const result: Array<{
    tenantUserId: string;
    messages: ThreadMessage[];
    lastAt: Date;
    unreadForLandlord: number;
  }> = [];

  for (const [tenantUserId, threadMessages] of grouped) {
    const ordered = sortChronological(threadMessages);
    let lastAt = ordered[0].createdAt;
    let unreadForLandlord = 0;
    for (const message of ordered) {
      if (message.createdAt.getTime() > lastAt.getTime()) lastAt = message.createdAt;
      if (landlordUserIds.has(message.receiverId) && message.readAt === null) {
        unreadForLandlord += 1;
      }
    }
    result.push({ tenantUserId, messages: ordered, lastAt, unreadForLandlord });
  }

  result.sort((a, b) => b.lastAt.getTime() - a.lastAt.getTime());
  return result;
}
