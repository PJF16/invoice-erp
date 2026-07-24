import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getSettings, isSmtpConfigured } from "@/lib/settings";
import { prisma } from "@/lib/prisma";
import { invoiceDayKey } from "@/lib/document-numbers";
import { SettingsForm } from "@/components/settings-form";
import { BackupSettingsForm } from "@/components/backup-settings-form";
import { getBackupSettings, publicBackupSettings } from "@/lib/backup";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await auth();
  if (session?.user.role !== "ADMIN") redirect("/");

  const [settings, rawBackupSettings] = await Promise.all([getSettings(), getBackupSettings()]);
  const backupSettings = publicBackupSettings(rawBackupSettings);
  const today = new Date();
  const dailySequence = await prisma.invoiceDailySequence.findUnique({
    where: { day: invoiceDayKey(today) },
  });

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-semibold">Einstellungen</h1>
      <p className="mb-6 text-sm text-gray-500">
        Firmendaten, Nummernkreise, E-Mail-Vorlagen und automatische Backups.
      </p>
      <SettingsForm
        settings={{
          name: settings.name,
          street: settings.street,
          zip: settings.zip,
          city: settings.city,
          country: settings.country,
          uid: settings.uid,
          iban: settings.iban,
          bic: settings.bic,
          bankName: settings.bankName,
          email: settings.email,
          phone: settings.phone,
          invoicePrefix: settings.invoicePrefix,
          invoiceNumberCycle: settings.invoiceNumberCycle,
          currentDailyInvoiceSeq: dailySequence?.lastSeq ?? 0,
          offerPrefix: settings.offerPrefix,
          deliveryNotePrefix: settings.deliveryNotePrefix,
          paymentDays: settings.paymentDays,
          skontoPercent: settings.skontoPercent,
          skontoDays: settings.skontoDays,
          emailSubject: settings.emailSubject,
          emailBody: settings.emailBody,
          autoReminders: settings.autoReminders,
          reminderDays: settings.reminderDays,
          maxReminders: settings.maxReminders,
          reminderSubject: settings.reminderSubject,
          reminderBody: settings.reminderBody,
          lastInvoiceYear: settings.lastInvoiceYear,
          lastInvoiceSeq: settings.lastInvoiceSeq,
          lastOfferYear: settings.lastOfferYear,
          lastOfferSeq: settings.lastOfferSeq,
          lastDeliveryNoteYear: settings.lastDeliveryNoteYear,
          lastDeliveryNoteSeq: settings.lastDeliveryNoteSeq,
        }}
        smtpConfigured={isSmtpConfigured()}
      />
      <BackupSettingsForm
        settings={{
          enabled: backupSettings.enabled,
          target: backupSettings.target,
          interval: backupSettings.interval,
          nextRun: backupSettings.nextRun?.toISOString() ?? null,
          localPath: backupSettings.localPath,
          smbHost: backupSettings.smbHost,
          smbPort: backupSettings.smbPort,
          smbShare: backupSettings.smbShare,
          smbPath: backupSettings.smbPath,
          smbDomain: backupSettings.smbDomain,
          smbUsername: backupSettings.smbUsername,
          smbPasswordConfigured: backupSettings.smbPasswordConfigured,
          lastRunAt: backupSettings.lastRunAt?.toISOString() ?? null,
          lastSuccessAt: backupSettings.lastSuccessAt?.toISOString() ?? null,
          lastError: backupSettings.lastError,
          running: backupSettings.running,
        }}
      />
    </div>
  );
}
