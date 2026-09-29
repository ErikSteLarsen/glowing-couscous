CREATE TABLE "AiProviderHealth" (
    "id" TEXT NOT NULL,
    "configHash" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "checkedAt" TIMESTAMP(3),
    "leaseUntil" TIMESTAMP(3),

    CONSTRAINT "AiProviderHealth_pkey" PRIMARY KEY ("id")
);
