-- CreateEnum
CREATE TYPE "MovementBillingStatus" AS ENUM ('PENDING', 'INVOICED', 'GIFTED');

-- AlterTable
ALTER TABLE "Movement"
ADD COLUMN "customerId" TEXT,
ADD COLUMN "billingStatus" "MovementBillingStatus";

-- AlterTable
ALTER TABLE "InvoiceLine"
ADD COLUMN "sourceMovementId" TEXT;

-- CreateIndex
CREATE INDEX "Movement_customerId_billingStatus_idx" ON "Movement"("customerId", "billingStatus");

-- CreateIndex
CREATE UNIQUE INDEX "InvoiceLine_sourceMovementId_key" ON "InvoiceLine"("sourceMovementId");

-- AddForeignKey
ALTER TABLE "Movement" ADD CONSTRAINT "Movement_customerId_fkey"
FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_sourceMovementId_fkey"
FOREIGN KEY ("sourceMovementId") REFERENCES "Movement"("id") ON DELETE SET NULL ON UPDATE CASCADE;
