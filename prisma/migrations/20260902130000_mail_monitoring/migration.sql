-- CreateEnum
CREATE TYPE "MailKind" AS ENUM ('INVOICE', 'REMINDER', 'EXPORT', 'PORTAL_LOGIN');

-- CreateEnum
CREATE TYPE "MailStatus" AS ENUM ('PENDING', 'SIMULATED', 'ACCEPTED', 'PARTIALLY_REJECTED', 'REJECTED', 'FAILED');

-- CreateEnum
CREATE TYPE "MailErrorCategory" AS ENUM ('CONFIGURATION', 'RECIPIENT_REJECTED', 'AUTHENTICATION', 'CONNECTION', 'TIMEOUT', 'SERVER', 'UNKNOWN');

-- CreateTable
CREATE TABLE "MailEvent" (
    "id" TEXT NOT NULL,
    "kind" "MailKind" NOT NULL,
    "status" "MailStatus" NOT NULL DEFAULT 'PENDING',
    "recipient" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "invoiceId" TEXT,
    "messageId" TEXT,
    "accepted" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "rejected" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "smtpResponse" TEXT,
    "errorCategory" "MailErrorCategory",
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "MailEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MailEvent_createdAt_idx" ON "MailEvent"("createdAt");

-- CreateIndex
CREATE INDEX "MailEvent_status_createdAt_idx" ON "MailEvent"("status", "createdAt");

-- CreateIndex
CREATE INDEX "MailEvent_invoiceId_createdAt_idx" ON "MailEvent"("invoiceId", "createdAt");

-- AddForeignKey
ALTER TABLE "MailEvent" ADD CONSTRAINT "MailEvent_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
