-- CreateEnum
CREATE TYPE "InvoiceType" AS ENUM ('INVOICE', 'CREDIT_NOTE');

-- AlterTable
ALTER TABLE "CompanySettings" ADD COLUMN     "autoReminders" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "maxReminders" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "reminderBody" TEXT NOT NULL DEFAULT 'Sehr geehrte Damen und Herren,

dürfen wir Sie freundlich daran erinnern, dass die Rechnung {nummer} vom {datum} über {betrag} seit {tage} Tagen überfällig ist?

Bitte überweisen Sie den offenen Betrag auf das angegebene Konto. Sollte sich Ihre Zahlung mit dieser Erinnerung überschnitten haben, betrachten Sie dieses Schreiben bitte als gegenstandslos.

Mit freundlichen Grüßen',
ADD COLUMN     "reminderDays" INTEGER NOT NULL DEFAULT 7,
ADD COLUMN     "reminderSubject" TEXT NOT NULL DEFAULT 'Zahlungserinnerung zu Rechnung {nummer}';

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "lastReminderAt" TIMESTAMP(3),
ADD COLUMN     "relatedInvoiceId" TEXT,
ADD COLUMN     "reminderCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "type" "InvoiceType" NOT NULL DEFAULT 'INVOICE';

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_relatedInvoiceId_fkey" FOREIGN KEY ("relatedInvoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
