-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "customerNumber" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Customer_customerNumber_key" ON "Customer"("customerNumber");
