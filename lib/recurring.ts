import { prisma } from "@/lib/prisma";
import { createDraftInvoice, finalizeInvoice, type LineInput } from "@/lib/invoices";
import { sendInvoiceEmail } from "@/lib/mailer";
import { getSettings, isSmtpConfigured } from "@/lib/settings";
import { addInterval } from "@/lib/dates";

/**
 * Erzeugt aus einer Vorlage eine finalisierte Rechnung.
 * Softwareartikel-Positionen lesen Preis/Bezeichnung ERST JETZT vom Artikel —
 * Preisänderungen wirken damit automatisch auf alle künftigen Rechnungen.
 */
export async function generateInvoiceFromTemplate(templateId: string, userId: string) {
  const template = await prisma.recurringInvoice.findUnique({
    where: { id: templateId },
    include: {
      lines: { orderBy: { position: "asc" }, include: { softwareItem: true } },
      customer: true,
    },
  });
  if (!template) throw new Error("Vorlage nicht gefunden");
  if (template.lines.length === 0) throw new Error(`Vorlage „${template.name}" hat keine Positionen`);

  const settings = await getSettings();
  const now = new Date();
  const periodStart = template.nextRun < now ? template.nextRun : now;
  const periodEnd = new Date(addInterval(periodStart, template.interval).getTime() - 86_400_000);

  const lines: LineInput[] = template.lines.map((line) => {
    if (line.softwareItem) {
      return {
        description: line.description?.trim()
          ? line.description
          : line.softwareItem.description
            ? `${line.softwareItem.name} — ${line.softwareItem.description}`
            : line.softwareItem.name,
        quantity: Number(line.quantity),
        unit: line.unit || line.softwareItem.unit,
        unitPrice: Number(line.softwareItem.unitPrice),
        taxRate: line.taxRate,
        softwareItemId: line.softwareItemId,
      };
    }
    return {
      description: line.description ?? "",
      quantity: Number(line.quantity),
      unit: line.unit,
      unitPrice: Number(line.unitPrice ?? 0),
      taxRate: line.taxRate,
    };
  });

  const dueDate = new Date(now);
  dueDate.setDate(dueDate.getDate() + (template.customer.paymentDays ?? settings.paymentDays));
  const draft = await createDraftInvoice({
    customerId: template.customerId,
    issueDate: now,
    dueDate,
    servicePeriodStart: periodStart,
    servicePeriodEnd: periodEnd,
    taxTreatment: template.taxTreatment,
    notes: template.notes,
    lines,
    recurringInvoiceId: template.id,
  });

  const invoice = await finalizeInvoice(draft.id, userId);

  await prisma.recurringInvoice.update({
    where: { id: template.id },
    data: { nextRun: addInterval(template.nextRun, template.interval) },
  });

  let emailSent = false;
  let emailError: string | null = null;
  if (template.autoSend) {
    if (isSmtpConfigured() && template.customer.email) {
      try {
        await sendInvoiceEmail(invoice.id);
        emailSent = true;
      } catch (e) {
        emailError = e instanceof Error ? e.message : "Versand fehlgeschlagen";
      }
    } else {
      emailError = template.customer.email
        ? "SMTP nicht konfiguriert"
        : "Kunde hat keine E-Mail-Adresse";
    }
  }

  return { invoice, emailSent, emailError };
}

async function getSystemUserId(): Promise<string | null> {
  const admin = await prisma.user.findFirst({ where: { role: "ADMIN" }, orderBy: { createdAt: "asc" } });
  return admin?.id ?? null;
}

/** Wird vom Scheduler (instrumentation.ts) und dem „Jetzt ausführen"-Button genutzt. */
export async function runDueRecurringInvoices() {
  const due = await prisma.recurringInvoice.findMany({
    where: { active: true, nextRun: { lte: new Date() } },
  });
  if (due.length === 0) return { generated: 0 };

  const userId = await getSystemUserId();
  if (!userId) return { generated: 0 };

  let generated = 0;
  for (const template of due) {
    try {
      await generateInvoiceFromTemplate(template.id, userId);
      generated++;
    } catch (e) {
      console.error(`Wiederkehrende Rechnung „${template.name}" fehlgeschlagen:`, e);
    }
  }
  return { generated };
}
