-- CreateEnum
CREATE TYPE "Module" AS ENUM ('STOCK', 'INVOICES');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "modules" "Module"[] DEFAULT ARRAY['STOCK', 'INVOICES']::"Module"[];
