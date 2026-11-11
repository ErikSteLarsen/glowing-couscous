-- Personal training loop: events, manual activity entries, timezone provenance, nullable load, and template cadence.

-- AlterTable
ALTER TABLE "Activity" ADD COLUMN     "eventId" INTEGER,
ADD COLUMN     "manualEntryKey" TEXT,
ADD COLUMN     "sourceTimezoneOffsetMinutes" INTEGER,
ADD COLUMN     "startedAt" TIMESTAMP(3),
ALTER COLUMN "tss" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Block" ADD COLUMN     "templateId" INTEGER;

-- AlterTable
ALTER TABLE "ShareLink" ADD COLUMN     "templateId" INTEGER;

-- AlterTable
ALTER TABLE "Template" ADD COLUMN     "cadence" TEXT NOT NULL DEFAULT 'day',
ADD COLUMN     "sport" TEXT NOT NULL DEFAULT 'RUNNING';

-- CreateTable
CREATE TABLE "AthleteEvent" (
    "id" SERIAL NOT NULL,
    "athleteId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "sport" TEXT NOT NULL,
    "eventDate" TIMESTAMP(3) NOT NULL,
    "targetFinishSec" INTEGER,
    "resultFinishSec" INTEGER,
    "resultNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AthleteEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AthleteEvent_athleteId_eventDate_idx" ON "AthleteEvent"("athleteId", "eventDate");

-- CreateIndex
CREATE UNIQUE INDEX "Activity_manualEntryKey_key" ON "Activity"("manualEntryKey");

-- CreateIndex
CREATE INDEX "Activity_eventId_idx" ON "Activity"("eventId");

-- CreateIndex
CREATE INDEX "Block_templateId_sortOrder_idx" ON "Block"("templateId", "sortOrder");

-- CreateIndex
CREATE INDEX "ShareLink_templateId_idx" ON "ShareLink"("templateId");

-- AddForeignKey
ALTER TABLE "Block" ADD CONSTRAINT "Block_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShareLink" ADD CONSTRAINT "ShareLink_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "AthleteEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AthleteEvent" ADD CONSTRAINT "AthleteEvent_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

