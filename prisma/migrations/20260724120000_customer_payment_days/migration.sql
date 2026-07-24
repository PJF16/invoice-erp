ALTER TABLE "Customer" ADD COLUMN "paymentDays" INTEGER;

ALTER TABLE "Customer"
ADD CONSTRAINT "Customer_paymentDays_check"
CHECK ("paymentDays" IS NULL OR ("paymentDays" >= 0 AND "paymentDays" <= 365));
