CREATE TYPE "InvoiceNumberCycle" AS ENUM ('YEARLY', 'DAILY');

ALTER TABLE "CompanySettings"
ADD COLUMN "invoiceNumberCycle" "InvoiceNumberCycle" NOT NULL DEFAULT 'YEARLY';

CREATE TABLE "InvoiceDailySequence" (
    "day" INTEGER NOT NULL,
    "lastSeq" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "InvoiceDailySequence_pkey" PRIMARY KEY ("day")
);
