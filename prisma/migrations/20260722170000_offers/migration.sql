-- CreateEnum
CREATE TYPE "OfferStatus" AS ENUM ('DRAFT', 'OPEN', 'ACCEPTED', 'REJECTED', 'CONVERTED');

-- Extend company settings with a dedicated yearly offer number range
ALTER TABLE "CompanySettings"
ADD COLUMN "offerPrefix" TEXT NOT NULL DEFAULT 'ANG-',
ADD COLUMN "lastOfferYear" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "lastOfferSeq" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "Offer" (
  "id" TEXT NOT NULL,
  "number" TEXT,
  "status" "OfferStatus" NOT NULL DEFAULT 'DRAFT',
  "customerId" TEXT NOT NULL,
  "customerName" TEXT NOT NULL DEFAULT '',
  "customerAddress" TEXT NOT NULL DEFAULT '',
  "customerUid" TEXT,
  "issueDate" TIMESTAMP(3) NOT NULL,
  "validUntil" TIMESTAMP(3) NOT NULL,
  "taxTreatment" "TaxTreatment" NOT NULL DEFAULT 'STANDARD',
  "notes" TEXT,
  "netTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "taxTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "grossTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "finalizedAt" TIMESTAMP(3),
  "acceptedAt" TIMESTAMP(3),
  "convertedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Offer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OfferLine" (
  "id" TEXT NOT NULL,
  "offerId" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  "description" TEXT NOT NULL,
  "quantity" DECIMAL(10,2) NOT NULL,
  "unit" TEXT NOT NULL DEFAULT 'Stk',
  "unitPrice" DECIMAL(10,2) NOT NULL,
  "taxRate" INTEGER NOT NULL DEFAULT 20,
  "lineNet" DECIMAL(12,2) NOT NULL,
  "softwareItemId" TEXT,
  "itemId" TEXT,
  "warehouseId" TEXT,

  CONSTRAINT "OfferLine_pkey" PRIMARY KEY ("id")
);

-- Link the generated invoice back to its source offer
ALTER TABLE "Invoice" ADD COLUMN "sourceOfferId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Offer_number_key" ON "Offer"("number");
CREATE INDEX "Offer_status_issueDate_idx" ON "Offer"("status", "issueDate");
CREATE UNIQUE INDEX "Invoice_sourceOfferId_key" ON "Invoice"("sourceOfferId");

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_customerId_fkey"
FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "OfferLine" ADD CONSTRAINT "OfferLine_offerId_fkey"
FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OfferLine" ADD CONSTRAINT "OfferLine_softwareItemId_fkey"
FOREIGN KEY ("softwareItemId") REFERENCES "SoftwareItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "OfferLine" ADD CONSTRAINT "OfferLine_itemId_fkey"
FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "OfferLine" ADD CONSTRAINT "OfferLine_warehouseId_fkey"
FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_sourceOfferId_fkey"
FOREIGN KEY ("sourceOfferId") REFERENCES "Offer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
