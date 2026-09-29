ALTER TABLE "Invoice" ADD COLUMN "recurringPeriod" TIMESTAMP(3);
CREATE UNIQUE INDEX "Invoice_recurringInvoiceId_recurringPeriod_key" ON "Invoice"("recurringInvoiceId", "recurringPeriod");
ALTER TABLE "InvoiceLine" ADD COLUMN "historicalSourceMovementId" TEXT,
  ADD COLUMN "historicalSourceDeliveryNoteLineId" TEXT;
-- Bereits stornierte Belege dürfen offene Übergaben nicht weiter reservieren.
UPDATE "InvoiceLine" AS l SET
  "historicalSourceMovementId" = l."sourceMovementId",
  "historicalSourceDeliveryNoteLineId" = l."sourceDeliveryNoteLineId",
  "sourceMovementId" = NULL, "sourceDeliveryNoteLineId" = NULL
FROM "Invoice" AS i WHERE l."invoiceId" = i.id AND i.status = 'CANCELED'
  AND (l."sourceDeliveryNoteLineId" IS NOT NULL OR (l."sourceMovementId" IS NOT NULL AND NOT l."stockBookedByInvoice"));
