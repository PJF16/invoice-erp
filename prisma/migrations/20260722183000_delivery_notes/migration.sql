-- Extend company settings with a dedicated yearly delivery-note number range
ALTER TABLE "CompanySettings"
ADD COLUMN "deliveryNotePrefix" TEXT NOT NULL DEFAULT 'LS-',
ADD COLUMN "lastDeliveryNoteYear" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "lastDeliveryNoteSeq" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "DeliveryNote" (
  "id" TEXT NOT NULL,
  "number" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "customerName" TEXT NOT NULL,
  "customerAddress" TEXT NOT NULL,
  "customerUid" TEXT,
  "issueDate" TIMESTAMP(3) NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdById" TEXT NOT NULL,

  CONSTRAINT "DeliveryNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryNoteLine" (
  "id" TEXT NOT NULL,
  "deliveryNoteId" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  "itemId" TEXT NOT NULL,
  "itemName" TEXT NOT NULL,
  "itemSku" TEXT,
  "warehouseId" TEXT NOT NULL,
  "warehouseName" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "movementId" TEXT NOT NULL,

  CONSTRAINT "DeliveryNoteLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryNote_number_key" ON "DeliveryNote"("number");
CREATE INDEX "DeliveryNote_customerId_issueDate_idx" ON "DeliveryNote"("customerId", "issueDate");
CREATE UNIQUE INDEX "DeliveryNoteLine_movementId_key" ON "DeliveryNoteLine"("movementId");

-- AddForeignKey
ALTER TABLE "DeliveryNote" ADD CONSTRAINT "DeliveryNote_customerId_fkey"
FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DeliveryNote" ADD CONSTRAINT "DeliveryNote_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DeliveryNoteLine" ADD CONSTRAINT "DeliveryNoteLine_deliveryNoteId_fkey"
FOREIGN KEY ("deliveryNoteId") REFERENCES "DeliveryNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DeliveryNoteLine" ADD CONSTRAINT "DeliveryNoteLine_itemId_fkey"
FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DeliveryNoteLine" ADD CONSTRAINT "DeliveryNoteLine_warehouseId_fkey"
FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DeliveryNoteLine" ADD CONSTRAINT "DeliveryNoteLine_movementId_fkey"
FOREIGN KEY ("movementId") REFERENCES "Movement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
