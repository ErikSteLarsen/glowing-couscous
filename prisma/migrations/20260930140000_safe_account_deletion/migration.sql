ALTER TABLE "ShareLink" ALTER COLUMN "createdById" DROP NOT NULL;
ALTER TABLE "ShareLink" ADD COLUMN "ownerDeleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ShareLink" DROP CONSTRAINT "ShareLink_createdById_fkey";
ALTER TABLE "ShareLink" ADD CONSTRAINT "ShareLink_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE TABLE "AccountDeletionAttempt" (
  "userId" INTEGER NOT NULL,
  "windowStartedAt" TIMESTAMP(3) NOT NULL,
  "attemptCount" INTEGER NOT NULL,
  CONSTRAINT "AccountDeletionAttempt_pkey" PRIMARY KEY ("userId")
);
ALTER TABLE "AccountDeletionAttempt" ADD CONSTRAINT "AccountDeletionAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
