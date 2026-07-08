import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getSettings, isSmtpConfigured } from "@/lib/settings";
import { SettingsForm } from "@/components/settings-form";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await auth();
  if (session?.user.role !== "ADMIN") redirect("/");

  const settings = await getSettings();

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-semibold">Einstellungen</h1>
      <p className="mb-6 text-sm text-gray-500">
        Firmendaten für den Rechnungskopf, Nummernkreis und E-Mail-Vorlagen.
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
          paymentDays: settings.paymentDays,
          emailSubject: settings.emailSubject,
          emailBody: settings.emailBody,
          autoReminders: settings.autoReminders,
          reminderDays: settings.reminderDays,
          maxReminders: settings.maxReminders,
          reminderSubject: settings.reminderSubject,
          reminderBody: settings.reminderBody,
          lastInvoiceYear: settings.lastInvoiceYear,
          lastInvoiceSeq: settings.lastInvoiceSeq,
        }}
        smtpConfigured={isSmtpConfigured()}
      />
    </div>
  );
}
