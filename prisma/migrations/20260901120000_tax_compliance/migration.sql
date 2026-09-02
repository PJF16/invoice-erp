-- Beleg- und Kundenklassifikation für die umsatzsteuerliche Prüfung.
CREATE TYPE "CustomerType" AS ENUM ('BUSINESS', 'CONSUMER');
CREATE TYPE "SupplyKind" AS ENUM ('GOODS', 'SERVICE', 'ELECTRONIC_SERVICE');
CREATE TYPE "VatVerificationStatus" AS ENUM ('VALID', 'INVALID', 'UNAVAILABLE', 'ERROR');
CREATE TYPE "EvidenceType" AS ENUM ('TRANSPORT_PROOF', 'EXPORT_PROOF', 'TAX_DOCUMENT', 'OTHER');

ALTER TABLE "Item"
  ADD COLUMN "supplyKind" "SupplyKind" NOT NULL DEFAULT 'GOODS';

ALTER TABLE "SoftwareItem"
  ADD COLUMN "supplyKind" "SupplyKind" NOT NULL DEFAULT 'ELECTRONIC_SERVICE';

ALTER TABLE "Customer"
  ADD COLUMN "countryCode" TEXT NOT NULL DEFAULT 'AT',
  ADD COLUMN "customerType" "CustomerType" NOT NULL DEFAULT 'BUSINESS';

-- Bestehende Freitext-Länder soweit eindeutig in ISO-2 überführen. Unbekannte
-- Werte bleiben AT und können anschließend im Kundenstamm korrigiert werden.
UPDATE "Customer"
SET "countryCode" = CASE lower(trim("country"))
  WHEN 'österreich' THEN 'AT'
  WHEN 'austria' THEN 'AT'
  WHEN 'deutschland' THEN 'DE'
  WHEN 'germany' THEN 'DE'
  WHEN 'schweiz' THEN 'CH'
  WHEN 'switzerland' THEN 'CH'
  WHEN 'italien' THEN 'IT'
  WHEN 'italy' THEN 'IT'
  WHEN 'frankreich' THEN 'FR'
  WHEN 'france' THEN 'FR'
  WHEN 'niederlande' THEN 'NL'
  WHEN 'netherlands' THEN 'NL'
  WHEN 'belgien' THEN 'BE'
  WHEN 'belgium' THEN 'BE'
  WHEN 'spanien' THEN 'ES'
  WHEN 'spain' THEN 'ES'
  WHEN 'tschechien' THEN 'CZ'
  WHEN 'czechia' THEN 'CZ'
  WHEN 'slowakei' THEN 'SK'
  WHEN 'slovakia' THEN 'SK'
  WHEN 'slowenien' THEN 'SI'
  WHEN 'slovenia' THEN 'SI'
  WHEN 'ungarn' THEN 'HU'
  WHEN 'hungary' THEN 'HU'
  WHEN 'polen' THEN 'PL'
  WHEN 'poland' THEN 'PL'
  ELSE 'AT'
END;

ALTER TABLE "Invoice"
  ADD COLUMN "customerCountryCode" TEXT NOT NULL DEFAULT 'AT',
  ADD COLUMN "customerType" "CustomerType" NOT NULL DEFAULT 'BUSINESS',
  ADD COLUMN "deliveryDate" TIMESTAMP(3),
  ADD COLUMN "taxDecisionReason" TEXT,
  ADD COLUMN "vatVerificationId" TEXT,
  ADD COLUMN "uidCheckOverrideReason" TEXT;

ALTER TABLE "Offer"
  ADD COLUMN "customerCountryCode" TEXT NOT NULL DEFAULT 'AT',
  ADD COLUMN "customerType" "CustomerType" NOT NULL DEFAULT 'BUSINESS',
  ADD COLUMN "deliveryDate" TIMESTAMP(3),
  ADD COLUMN "servicePeriodStart" TIMESTAMP(3),
  ADD COLUMN "servicePeriodEnd" TIMESTAMP(3);

ALTER TABLE "InvoiceLine" ADD COLUMN "supplyKind" "SupplyKind" NOT NULL DEFAULT 'SERVICE';
ALTER TABLE "OfferLine" ADD COLUMN "supplyKind" "SupplyKind" NOT NULL DEFAULT 'SERVICE';
ALTER TABLE "RecurringInvoiceLine" ADD COLUMN "supplyKind" "SupplyKind" NOT NULL DEFAULT 'SERVICE';

-- Vom Benutzer gewünschte Migration: sämtliche Softwareartikel und sämtliche
-- daraus hervorgegangenen Positionen gelten zunächst als elektronische Leistung.
UPDATE "SoftwareItem" SET "supplyKind" = 'ELECTRONIC_SERVICE';
UPDATE "Item" SET "supplyKind" = 'GOODS';
UPDATE "InvoiceLine" SET "supplyKind" = 'ELECTRONIC_SERVICE' WHERE "softwareItemId" IS NOT NULL;
UPDATE "InvoiceLine" SET "supplyKind" = 'GOODS' WHERE "itemId" IS NOT NULL;
UPDATE "OfferLine" SET "supplyKind" = 'ELECTRONIC_SERVICE' WHERE "softwareItemId" IS NOT NULL;
UPDATE "OfferLine" SET "supplyKind" = 'GOODS' WHERE "itemId" IS NOT NULL;
UPDATE "RecurringInvoiceLine" SET "supplyKind" = 'ELECTRONIC_SERVICE' WHERE "softwareItemId" IS NOT NULL;

CREATE TABLE "VatVerification" (
  "id" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "countryCode" TEXT NOT NULL,
  "vatNumber" TEXT NOT NULL,
  "status" "VatVerificationStatus" NOT NULL,
  "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "requestDate" TIMESTAMP(3),
  "name" TEXT,
  "address" TEXT,
  "requestId" TEXT,
  "errorMessage" TEXT,
  CONSTRAINT "VatVerification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "VatVerification_customerId_checkedAt_idx" ON "VatVerification"("customerId", "checkedAt");
CREATE INDEX "VatVerification_countryCode_vatNumber_checkedAt_idx" ON "VatVerification"("countryCode", "vatNumber", "checkedAt");

ALTER TABLE "VatVerification"
  ADD CONSTRAINT "VatVerification_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Invoice"
  ADD CONSTRAINT "Invoice_vatVerificationId_fkey"
  FOREIGN KEY ("vatVerificationId") REFERENCES "VatVerification"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "InvoiceEvidence" (
  "id" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "type" "EvidenceType" NOT NULL,
  "fileName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "size" INTEGER NOT NULL,
  "data" BYTEA NOT NULL,
  "note" TEXT,
  "uploadedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "InvoiceEvidence_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "InvoiceEvidence_invoiceId_createdAt_idx" ON "InvoiceEvidence"("invoiceId", "createdAt");

ALTER TABLE "InvoiceEvidence"
  ADD CONSTRAINT "InvoiceEvidence_invoiceId_fkey"
  FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InvoiceEvidence"
  ADD CONSTRAINT "InvoiceEvidence_uploadedById_fkey"
  FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
