import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api-helpers";
import { getSettings, isSmtpConfigured } from "@/lib/settings";
import { renderInvoicePdf } from "@/lib/invoice-pdf";
import { getMailTransport, fillMailTemplate } from "@/lib/mail-transport";

const eur = new Intl.NumberFormat("de-AT", { style: "currency", currency: "EUR" });
const dateFmt = new Intl.DateTimeFormat("de-AT", { dateStyle: "medium" });

export function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function daysOverdue(dueDate: Date) {
  return Math.max(0, Math.floor((startOfToday().getTime() - dueDate.getTime()) / 86_400_000));
}

/** Überfällige Rechnungen: finalisiert, unbezahlt, Fälligkeit überschritten. */
export function overdueWhere() {
  return {
    type: "INVOICE" as const,
    status: { in: ["OPEN", "SENT"] as ("OPEN" | "SENT")[] },
    dueDate: { lt: startOfToday() },
  };
}

/** Versendet eine Zahlungserinnerung mit Rechnungs-PDF und zählt die Mahnstufe hoch. */
export async function sendReminderEmail(invoiceId: string) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { lines: { orderBy: { position: "asc" } }, customer: true },
  });
  if (!invoice) throw new ApiError(404, "Rechnung nicht gefunden");
  if (invoice.type !== "INVOICE" || !invoice.number) {
    throw new ApiError(400, "Nur finalisierte Rechnungen können gemahnt werden");
  }
  if (invoice.status === "PAID" || invoice.status === "CANCELED") {
    throw new ApiError(400, "Rechnung ist bereits bezahlt bzw. storniert");
  }
  if (!invoice.customer.email) {
    throw new ApiError(400, `Kunde „${invoice.customer.name}" hat keine E-Mail-Adresse`);
  }

  const settings = await getSettings();
  const pdf = await renderInvoicePdf(invoice, settings);
  const vars = {
    nummer: invoice.number,
    kunde: invoice.customerName || invoice.customer.name,
    datum: dateFmt.format(invoice.issueDate),
    betrag: eur.format(Number(invoice.grossTotal)),
    tage: String(daysOverdue(invoice.dueDate)),
  };

  const transport = getMailTransport();
  await transport.sendMail({
    from: process.env.SMTP_FROM ?? process.env.SMTP_USER,
    to: invoice.customer.email,
    subject: fillMailTemplate(settings.reminderSubject, vars),
    text: fillMailTemplate(settings.reminderBody, vars),
    attachments: [
      {
        filename: `Rechnung_${invoice.number.replace(/[^\w-]/g, "_")}.pdf`,
        content: pdf,
        contentType: "application/pdf",
      },
    ],
  });

  return prisma.invoice.update({
    where: { id: invoiceId },
    data: { reminderCount: { increment: 1 }, lastReminderAt: new Date() },
  });
}

/**
 * Automatische Zahlungserinnerungen (Scheduler): frühestens `reminderDays` Tage
 * nach Fälligkeit, danach im selben Abstand erneut, maximal `maxReminders` Mal.
 * Nur aktiv, wenn in den Einstellungen eingeschaltet und SMTP konfiguriert ist.
 */
export async function runAutoReminders() {
  const settings = await getSettings();
  if (!settings.autoReminders || !isSmtpConfigured()) return { sent: 0 };

  const threshold = new Date(startOfToday().getTime() - settings.reminderDays * 86_400_000);
  const candidates = await prisma.invoice.findMany({
    where: {
      ...overdueWhere(),
      dueDate: { lt: threshold },
      reminderCount: { lt: settings.maxReminders },
      customer: { email: { not: null } },
      OR: [{ lastReminderAt: null }, { lastReminderAt: { lt: threshold } }],
    },
  });

  let sent = 0;
  for (const invoice of candidates) {
    // lastReminderAt muss zusätzlich reminderDays zurückliegen (threshold bezieht sich auf dueDate)
    if (
      invoice.lastReminderAt &&
      startOfToday().getTime() - invoice.lastReminderAt.getTime() < settings.reminderDays * 86_400_000
    ) {
      continue;
    }
    try {
      await sendReminderEmail(invoice.id);
      sent++;
    } catch (e) {
      console.error(`Zahlungserinnerung für ${invoice.number} fehlgeschlagen:`, e);
    }
  }
  return { sent };
}
