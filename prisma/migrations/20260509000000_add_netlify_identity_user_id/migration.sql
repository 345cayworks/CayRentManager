-- Add Netlify Identity linkage and app session bridge.
ALTER TABLE "User" ADD COLUMN "netlifyUserId" TEXT;
ALTER TABLE "User" ADD COLUMN "disabledById" TEXT;
ALTER TABLE "User" ALTER COLUMN "email" SET NOT NULL;

CREATE TABLE "AppSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_netlifyUserId_key" ON "User"("netlifyUserId");
CREATE UNIQUE INDEX "AppSession_tokenHash_key" ON "AppSession"("tokenHash");

ALTER TABLE "AppSession" ADD CONSTRAINT "AppSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
