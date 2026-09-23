ALTER TYPE "MailKind" ADD VALUE 'DELIVERY_NOTE';

ALTER TABLE "DeliveryNote"
ADD COLUMN "sentAt" TIMESTAMP(3);

ALTER TABLE "MailEvent"
ADD COLUMN "deliveryNoteId" TEXT;

ALTER TABLE "MailEvent"
ADD CONSTRAINT "MailEvent_deliveryNoteId_fkey"
FOREIGN KEY ("deliveryNoteId") REFERENCES "DeliveryNote"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "MailEvent_deliveryNoteId_createdAt_idx"
ON "MailEvent"("deliveryNoteId", "createdAt");
