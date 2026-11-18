CREATE TYPE "ExportRunPhase" AS ENUM ('PREPARING', 'SENDING', 'REVIEW');

ALTER TABLE "ExportSchedule"
    ADD COLUMN "exportRunId" TEXT,
    ADD COLUMN "exportRunPhase" "ExportRunPhase",
    ADD COLUMN "exportRunStartedAt" TIMESTAMP(3),
    ADD COLUMN "exportRunReference" TIMESTAMP(3),
    ADD COLUMN "exportRunScheduled" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "MailEvent" ADD COLUMN "exportRunId" TEXT;

CREATE UNIQUE INDEX "MailEvent_exportRunId_key" ON "MailEvent"("exportRunId");
CREATE INDEX "ExportSchedule_active_nextRun_idx" ON "ExportSchedule"("active", "nextRun");
CREATE INDEX "ExportSchedule_exportRunPhase_exportRunStartedAt_idx"
    ON "ExportSchedule"("exportRunPhase", "exportRunStartedAt");
