-- CreateEnum
CREATE TYPE "ExportPeriod" AS ENUM ('PREVIOUS_MONTH', 'PREVIOUS_QUARTER', 'PREVIOUS_YEAR', 'ALL_TIME');

-- CreateTable
CREATE TABLE "ExportSchedule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "interval" "RecurringInterval" NOT NULL DEFAULT 'MONTHLY',
    "nextRun" TIMESTAMP(3) NOT NULL,
    "period" "ExportPeriod" NOT NULL DEFAULT 'PREVIOUS_MONTH',
    "types" "InvoiceType"[] DEFAULT ARRAY['INVOICE']::"InvoiceType"[],
    "recipientEmail" TEXT NOT NULL,
    "emailSubject" TEXT NOT NULL DEFAULT 'Belegexport {zeitraum}',
    "emailBody" TEXT NOT NULL DEFAULT 'Sehr geehrte Damen und Herren,

anbei der Belegexport für {zeitraum}.

Mit freundlichen Grüßen',
    "lastRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExportSchedule_pkey" PRIMARY KEY ("id")
);
