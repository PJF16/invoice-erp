ALTER TYPE "InvoiceNumberCycle" ADD VALUE 'CUSTOM';

ALTER TABLE "CompanySettings"
ADD COLUMN "nextInvoiceNumber" INTEGER NOT NULL DEFAULT 1;
