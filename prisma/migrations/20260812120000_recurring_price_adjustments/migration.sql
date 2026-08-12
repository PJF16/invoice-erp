CREATE TYPE "PriceAdjustmentType" AS ENUM ('ABSOLUTE', 'PERCENTAGE');

ALTER TABLE "RecurringInvoiceLine"
  ADD COLUMN "priceAdjustmentType" "PriceAdjustmentType" NOT NULL DEFAULT 'ABSOLUTE',
  ADD COLUMN "priceAdjustmentValue" DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN "priceAdjustmentIsDiscount" BOOLEAN NOT NULL DEFAULT false;
