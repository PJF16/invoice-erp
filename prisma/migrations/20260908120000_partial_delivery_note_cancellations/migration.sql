ALTER TABLE "DeliveryNoteLine"
ADD COLUMN "canceledQuantity" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "DeliveryNoteLine"
ADD CONSTRAINT "DeliveryNoteLine_canceledQuantity_check"
CHECK ("canceledQuantity" >= 0 AND "canceledQuantity" <= "quantity");

CREATE TABLE "DeliveryNoteCancellation" (
  "id" TEXT NOT NULL,
  "deliveryNoteId" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "canceledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "canceledById" TEXT NOT NULL,
  CONSTRAINT "DeliveryNoteCancellation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DeliveryNoteCancellationLine" (
  "cancellationId" TEXT NOT NULL,
  "deliveryNoteLineId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  CONSTRAINT "DeliveryNoteCancellationLine_pkey" PRIMARY KEY ("cancellationId", "deliveryNoteLineId"),
  CONSTRAINT "DeliveryNoteCancellationLine_quantity_check" CHECK ("quantity" > 0)
);

CREATE INDEX "DeliveryNoteCancellation_deliveryNoteId_canceledAt_idx"
ON "DeliveryNoteCancellation"("deliveryNoteId", "canceledAt");

ALTER TABLE "DeliveryNoteCancellation"
ADD CONSTRAINT "DeliveryNoteCancellation_deliveryNoteId_fkey"
FOREIGN KEY ("deliveryNoteId") REFERENCES "DeliveryNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DeliveryNoteCancellation"
ADD CONSTRAINT "DeliveryNoteCancellation_canceledById_fkey"
FOREIGN KEY ("canceledById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DeliveryNoteCancellationLine"
ADD CONSTRAINT "DeliveryNoteCancellationLine_cancellationId_fkey"
FOREIGN KEY ("cancellationId") REFERENCES "DeliveryNoteCancellation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DeliveryNoteCancellationLine"
ADD CONSTRAINT "DeliveryNoteCancellationLine_deliveryNoteLineId_fkey"
FOREIGN KEY ("deliveryNoteLineId") REFERENCES "DeliveryNoteLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
