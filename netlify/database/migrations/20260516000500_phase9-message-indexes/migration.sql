-- Phase 9: messaging indexes for workspace-scoped inbox/thread queries.
-- Idempotent: safe to run multiple times.

CREATE INDEX IF NOT EXISTS "Message_landlordId_receiverId_readAt_idx"
  ON "Message" ("landlordId", "receiverId", "readAt");

CREATE INDEX IF NOT EXISTS "Message_landlordId_senderId_idx"
  ON "Message" ("landlordId", "senderId");

CREATE INDEX IF NOT EXISTS "Message_landlordId_createdAt_idx"
  ON "Message" ("landlordId", "createdAt");
