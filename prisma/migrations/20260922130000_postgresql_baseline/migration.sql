-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "role" TEXT,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "selfCoached" BOOLEAN NOT NULL DEFAULT false,
    "coachId" INTEGER,
    "prefsJson" TEXT,
    "performanceProfileJson" TEXT,
    "passwordHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlacementRequest" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "requestKey" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "sessionIdsJson" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlacementRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoachRequest" (
    "id" SERIAL NOT NULL,
    "athleteId" INTEGER NOT NULL,
    "coachId" INTEGER NOT NULL,
    "pendingAthleteId" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoachRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Plan" (
    "id" SERIAL NOT NULL,
    "athleteId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "goalRace" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingPlan" (
    "id" SERIAL NOT NULL,
    "coachOwnerId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "summary" TEXT,
    "sport" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" SERIAL NOT NULL,
    "athleteId" INTEGER,
    "coachOwnerId" INTEGER,
    "trainingPlanId" INTEGER,
    "planId" INTEGER,
    "templateId" INTEGER,
    "assignedById" INTEGER,
    "date" TIMESTAMP(3),
    "planWeekday" INTEGER,
    "timeLabel" TEXT,
    "sport" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "coachNotes" TEXT,
    "athleteNotes" TEXT,
    "coachBaselineJson" TEXT,
    "rpe" INTEGER,
    "sportMetricsJson" TEXT,
    "status" TEXT NOT NULL DEFAULT 'planned',
    "source" TEXT NOT NULL,
    "adjusted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Block" (
    "id" SERIAL NOT NULL,
    "sessionId" INTEGER,
    "templateId" INTEGER,
    "kind" TEXT NOT NULL,
    "zone" INTEGER NOT NULL,
    "durationSec" INTEGER NOT NULL,
    "reps" INTEGER,
    "targetType" TEXT,
    "targetLow" INTEGER,
    "targetHigh" INTEGER,
    "targetMode" TEXT NOT NULL DEFAULT 'absolute',
    "targetReference" TEXT,
    "targetLowDecimal" TEXT,
    "targetHighDecimal" TEXT,
    "note" TEXT,
    "skipped" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL,

    CONSTRAINT "Block_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Template" (
    "id" SERIAL NOT NULL,
    "ownerId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "sport" TEXT NOT NULL,
    "cadence" TEXT NOT NULL DEFAULT 'day',
    "summary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShareLink" (
    "id" SERIAL NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "sessionId" INTEGER,
    "templateId" INTEGER,
    "createdById" INTEGER NOT NULL,
    "snapshotJson" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShareLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Activity" (
    "id" SERIAL NOT NULL,
    "sessionId" INTEGER NOT NULL,
    "athleteId" INTEGER NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL,
    "durationSec" INTEGER NOT NULL,
    "tss" INTEGER NOT NULL,
    "compliancePct" INTEGER,
    "zoneDistributionJson" TEXT NOT NULL,
    "segmentsJson" TEXT NOT NULL,
    "metricsSource" TEXT NOT NULL DEFAULT 'manual-planned',
    "notes" TEXT,
    "actualSnapshotJson" TEXT,
    "rpe" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingPlanAssignment" (
    "id" SERIAL NOT NULL,
    "trainingPlanId" INTEGER NOT NULL,
    "athleteId" INTEGER NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "assignedBy" INTEGER NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainingPlanAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Assignment" (
    "id" SERIAL NOT NULL,
    "sessionId" INTEGER NOT NULL,
    "athleteId" INTEGER NOT NULL,
    "assignedBy" INTEGER NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceSessionId" INTEGER,
    "targetDate" TIMESTAMP(3),
    "trainingPlanAssignmentId" INTEGER,

    CONSTRAINT "Assignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "PlacementRequest_userId_createdAt_idx" ON "PlacementRequest"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PlacementRequest_userId_requestKey_key" ON "PlacementRequest"("userId", "requestKey");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "CoachRequest_pendingAthleteId_key" ON "CoachRequest"("pendingAthleteId");

-- CreateIndex
CREATE UNIQUE INDEX "CoachRequest_athleteId_coachId_key" ON "CoachRequest"("athleteId", "coachId");

-- CreateIndex
CREATE INDEX "Plan_athleteId_startDate_endDate_idx" ON "Plan"("athleteId", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "TrainingPlan_coachOwnerId_sport_idx" ON "TrainingPlan"("coachOwnerId", "sport");

-- CreateIndex
CREATE INDEX "Session_athleteId_date_idx" ON "Session"("athleteId", "date");

-- CreateIndex
CREATE INDEX "Session_planId_date_idx" ON "Session"("planId", "date");

-- CreateIndex
CREATE INDEX "Session_coachOwnerId_date_idx" ON "Session"("coachOwnerId", "date");

-- CreateIndex
CREATE INDEX "Session_trainingPlanId_planWeekday_idx" ON "Session"("trainingPlanId", "planWeekday");

-- CreateIndex
CREATE INDEX "Block_sessionId_sortOrder_idx" ON "Block"("sessionId", "sortOrder");

-- CreateIndex
CREATE INDEX "Block_templateId_sortOrder_idx" ON "Block"("templateId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "ShareLink_tokenHash_key" ON "ShareLink"("tokenHash");

-- CreateIndex
CREATE INDEX "ShareLink_sessionId_idx" ON "ShareLink"("sessionId");

-- CreateIndex
CREATE INDEX "ShareLink_templateId_idx" ON "ShareLink"("templateId");

-- CreateIndex
CREATE INDEX "ShareLink_createdById_idx" ON "ShareLink"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "Activity_sessionId_key" ON "Activity"("sessionId");

-- CreateIndex
CREATE INDEX "Activity_athleteId_completedAt_idx" ON "Activity"("athleteId", "completedAt");

-- CreateIndex
CREATE INDEX "TrainingPlanAssignment_athleteId_weekStart_idx" ON "TrainingPlanAssignment"("athleteId", "weekStart");

-- CreateIndex
CREATE UNIQUE INDEX "TrainingPlanAssignment_trainingPlanId_athleteId_weekStart_key" ON "TrainingPlanAssignment"("trainingPlanId", "athleteId", "weekStart");

-- CreateIndex
CREATE INDEX "Assignment_athleteId_assignedAt_idx" ON "Assignment"("athleteId", "assignedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Assignment_sessionId_athleteId_key" ON "Assignment"("sessionId", "athleteId");

-- CreateIndex
CREATE UNIQUE INDEX "Assignment_sourceSessionId_athleteId_targetDate_key" ON "Assignment"("sourceSessionId", "athleteId", "targetDate");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlacementRequest" ADD CONSTRAINT "PlacementRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachRequest" ADD CONSTRAINT "CoachRequest_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachRequest" ADD CONSTRAINT "CoachRequest_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Plan" ADD CONSTRAINT "Plan_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingPlan" ADD CONSTRAINT "TrainingPlan_coachOwnerId_fkey" FOREIGN KEY ("coachOwnerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_coachOwnerId_fkey" FOREIGN KEY ("coachOwnerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_trainingPlanId_fkey" FOREIGN KEY ("trainingPlanId") REFERENCES "TrainingPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Block" ADD CONSTRAINT "Block_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Block" ADD CONSTRAINT "Block_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Template" ADD CONSTRAINT "Template_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShareLink" ADD CONSTRAINT "ShareLink_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShareLink" ADD CONSTRAINT "ShareLink_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShareLink" ADD CONSTRAINT "ShareLink_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingPlanAssignment" ADD CONSTRAINT "TrainingPlanAssignment_trainingPlanId_fkey" FOREIGN KEY ("trainingPlanId") REFERENCES "TrainingPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingPlanAssignment" ADD CONSTRAINT "TrainingPlanAssignment_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingPlanAssignment" ADD CONSTRAINT "TrainingPlanAssignment_assignedBy_fkey" FOREIGN KEY ("assignedBy") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_assignedBy_fkey" FOREIGN KEY ("assignedBy") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_sourceSessionId_fkey" FOREIGN KEY ("sourceSessionId") REFERENCES "Session"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_trainingPlanAssignmentId_fkey" FOREIGN KEY ("trainingPlanAssignmentId") REFERENCES "TrainingPlanAssignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
