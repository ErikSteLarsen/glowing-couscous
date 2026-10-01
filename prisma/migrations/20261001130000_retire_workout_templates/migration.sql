-- Remove retired definitions and links; applied sessions are independent copies.
DELETE FROM "ShareLink" WHERE "templateId" IS NOT NULL OR "snapshotJson" ~ '"sourceKind"[[:space:]]*:[[:space:]]*"template"';
DELETE FROM "Template" WHERE "routineJson" IS NULL OR btrim("routineJson") = '';
DELETE FROM "Block" WHERE "templateId" IS NOT NULL;
ALTER TABLE "Block" DROP CONSTRAINT "Block_templateId_fkey";
ALTER TABLE "ShareLink" DROP CONSTRAINT "ShareLink_templateId_fkey";
DROP INDEX "Block_templateId_sortOrder_idx";
DROP INDEX "ShareLink_templateId_idx";
ALTER TABLE "Block" DROP COLUMN "templateId";
ALTER TABLE "ShareLink" DROP COLUMN "templateId";
ALTER TABLE "Template" DROP COLUMN "sport", DROP COLUMN "cadence", ALTER COLUMN "routineJson" SET NOT NULL;
