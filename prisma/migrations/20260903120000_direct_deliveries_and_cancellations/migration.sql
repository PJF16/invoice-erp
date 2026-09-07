CREATE TYPE "DeliveryMethod" AS ENUM ('STOCK', 'DISTRIBUTOR_DIRECT');
CREATE TYPE "DeliveryNoteStatus" AS ENUM ('ACTIVE', 'CANCELED');
ALTER TYPE "MovementBillingStatus" ADD VALUE 'CANCELED';

ALTER TABLE "DeliveryNote"
  ADD COLUMN "deliveryMethod" "DeliveryMethod" NOT NULL DEFAULT 'STOCK',
  ADD COLUMN "distributor" TEXT,
  ADD COLUMN "distributorReference" TEXT,
  ADD COLUMN "trackingNumber" TEXT,
  ADD COLUMN "status" "DeliveryNoteStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "canceledAt" TIMESTAMP(3),
  ADD COLUMN "canceledReason" TEXT,
  ADD COLUMN "canceledById" TEXT;

ALTER TABLE "DeliveryNoteLine"
  ADD COLUMN "billingStatus" "MovementBillingStatus" NOT NULL DEFAULT 'PENDING',
  ALTER COLUMN "warehouseId" DROP NOT NULL,
  ALTER COLUMN "warehouseName" DROP NOT NULL,
  ALTER COLUMN "movementId" DROP NOT NULL;

UPDATE "DeliveryNoteLine" AS line
SET "billingStatus" = movement."billingStatus"
FROM "Movement" AS movement
WHERE line."movementId" = movement."id" AND movement."billingStatus" IS NOT NULL;

ALTER TABLE "InvoiceLine"
  ADD COLUMN "sourceDeliveryNoteLineId" TEXT,
  ADD COLUMN "stockBookedByInvoice" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Movement"
  ADD COLUMN "canceledAt" TIMESTAMP(3),
  ADD COLUMN "canceledReason" TEXT,
  ADD COLUMN "canceledById" TEXT;

UPDATE "InvoiceLine" AS line
SET "stockBookedByInvoice" = true
FROM "Movement" AS movement
WHERE line."sourceMovementId" = movement."id"
  AND movement."note" LIKE 'Rechnung %'
  AND NOT EXISTS (SELECT 1 FROM "DeliveryNoteLine" dnl WHERE dnl."movementId" = movement."id");

CREATE UNIQUE INDEX "InvoiceLine_sourceDeliveryNoteLineId_key"
  ON "InvoiceLine"("sourceDeliveryNoteLineId");

ALTER TABLE "DeliveryNote"
  ADD CONSTRAINT "DeliveryNote_canceledById_fkey"
  FOREIGN KEY ("canceledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InvoiceLine"
  ADD CONSTRAINT "InvoiceLine_sourceDeliveryNoteLineId_fkey"
  FOREIGN KEY ("sourceDeliveryNoteLineId") REFERENCES "DeliveryNoteLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;
