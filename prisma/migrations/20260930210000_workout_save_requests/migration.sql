CREATE TABLE "WorkoutSaveRequest" (
  "id" SERIAL NOT NULL,
  "userId" INTEGER NOT NULL,
  "owner" TEXT NOT NULL,
  "requestKey" TEXT NOT NULL,
  "payloadHash" TEXT NOT NULL,
  "sessionId" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkoutSaveRequest_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "WorkoutSaveRequest_userId_owner_requestKey_key" ON "WorkoutSaveRequest"("userId", "owner", "requestKey");
ALTER TABLE "WorkoutSaveRequest" ADD CONSTRAINT "WorkoutSaveRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
