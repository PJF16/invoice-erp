CREATE TYPE "RecurringDeliveryState" AS ENUM ('PENDING', 'SENDING', 'SENT', 'FAILED', 'REVIEW');
ALTER TABLE "Invoice" ADD COLUMN "recurringDeliveryState" "RecurringDeliveryState",
  ADD COLUMN "recurringDeliveryAttempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "recurringDeliveryStartedAt" TIMESTAMP(3),
  ADD COLUMN "recurringDeliveryRetryAt" TIMESTAMP(3),
  ADD COLUMN "recurringDeliveryError" TEXT;
CREATE INDEX "Invoice_recurringDeliveryState_recurringDeliveryRetryAt_idx"
  ON "Invoice"("recurringDeliveryState", "recurringDeliveryRetryAt");
-- Vorhandene, nie versendete Abo-Rechnungen benötigen eine Sichtprüfung.
-- Ein automatisches Nachsenden könnte bereits außerhalb der App zugestellte Mails doppeln.
UPDATE "Invoice" AS i SET "recurringDeliveryState" = 'REVIEW',
  "recurringDeliveryError" = 'Älterer Versandstatus unklar. Bitte Mail-Monitoring prüfen und bei Bedarf manuell senden.'
FROM "RecurringInvoice" AS r WHERE i."recurringInvoiceId" = r.id
  AND r."autoSend" = TRUE AND i."sentAt" IS NULL AND i."number" IS NOT NULL
  AND i."status" IN ('OPEN', 'SENT');
UPDATE "Invoice" SET "recurringDeliveryState" = 'SENT'
  WHERE "recurringInvoiceId" IS NOT NULL AND "sentAt" IS NOT NULL;
