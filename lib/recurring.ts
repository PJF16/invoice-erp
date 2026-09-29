import { prisma } from "@/lib/prisma";
import { createDraftInvoiceTx, finalizeInvoiceTx, type LineInput } from "@/lib/invoices";
import { deliverRecurringInvoice, retryPendingRecurringDeliveries } from "@/lib/mailer";
import { getSettings } from "@/lib/settings";
import { ApiError } from "@/lib/api-helpers";
import { addInterval } from "@/lib/dates";

/**
 * Erzeugt aus einer Vorlage eine finalisierte Rechnung.
 * Softwareartikel-Positionen lesen Preis/Bezeichnung ERST JETZT vom Artikel —
 * Preisänderungen wirken damit automatisch auf alle künftigen Rechnungen.
 */
export async function generateInvoiceFromTemplate(templateId: string, userId: string, expectedRun?: Date) {
  // Den beim Auslösen sichtbaren Termin behalten; ein konkurrierender Lauf darf
  // nach dem Warten nicht versehentlich schon die nächste Periode abrechnen.
  const observed = expectedRun ?? (await prisma.recurringInvoice.findUnique({ where: { id: templateId }, select: { nextRun: true } }))?.nextRun;
  if (!observed) throw new ApiError(404, "Vorlage nicht gefunden");
  const { invoice, template } = await prisma.$transaction(async (tx) => {
  await tx.$queryRaw`SELECT "id" FROM "RecurringInvoice" WHERE "id" = ${templateId} FOR UPDATE`;
  const template = await tx.recurringInvoice.findUnique({
    where: { id: templateId },
    include: {
      lines: { orderBy: { position: "asc" }, include: { softwareItem: true } },
      customer: true,
    },
  });
  if (!template) throw new Error("Vorlage nicht gefunden");
  if (template.lines.length === 0) throw new Error(`Vorlage „${template.name}" hat keine Positionen`);

  if (template.nextRun.getTime() !== observed.getTime()) throw new ApiError(409, "Diese Abrechnungsperiode wurde bereits verarbeitet. Bitte die Seite aktualisieren.");
  const settings = await getSettings(tx);
  const now = new Date();
  const periodStart = template.nextRun;
  const periodEnd = new Date(addInterval(periodStart, template.interval).getTime() - 86_400_000);

  const lines: LineInput[] = template.lines.map((line) => {
    if (line.softwareItem) {
      const basePrice = Number(line.softwareItem.unitPrice);
      const adjustment = line.priceAdjustmentType === "PERCENTAGE"
        ? basePrice * (Number(line.priceAdjustmentValue) / 100)
        : Number(line.priceAdjustmentValue);
      return {
        description: [
          line.softwareItem.name,
          line.softwareItem.description?.trim(),
          line.description?.trim(),
        ].filter(Boolean).join("\n"),
        quantity: Number(line.quantity),
        unit: line.unit || line.softwareItem.unit,
        unitPrice: Math.max(0, basePrice + (line.priceAdjustmentIsDiscount ? -adjustment : adjustment)),
        taxRate: line.taxRate,
        supplyKind: line.softwareItem.supplyKind,
        softwareItemId: line.softwareItemId,
      };
    }
    return {
      description: line.description ?? "",
      quantity: Number(line.quantity),
      unit: line.unit,
      unitPrice: Number(line.unitPrice ?? 0),
      taxRate: line.taxRate,
      supplyKind: line.supplyKind,
    };
  });

  const dueDate = new Date(now);
  dueDate.setDate(dueDate.getDate() + (template.customer.paymentDays ?? settings.paymentDays));
  const draft = await createDraftInvoiceTx(tx, {
    customerId: template.customerId,
    issueDate: now,
    dueDate,
    servicePeriodStart: periodStart,
    servicePeriodEnd: periodEnd,
    taxTreatment: template.taxTreatment,
    notes: template.notes,
    lines,
    recurringInvoiceId: template.id,
    recurringPeriod: template.nextRun,
    recurringAutoSend: template.autoSend,
  });

  const invoice = await finalizeInvoiceTx(tx, draft.id, userId);

  await tx.recurringInvoice.update({
    where: { id: template.id },
    data: { nextRun: addInterval(template.nextRun, template.interval) },
  });

  return { invoice, template };
  }, { timeout: 15_000 });

  // Die Rechnung bleibt bei SMTP-Problemen als offener Versandauftrag gespeichert.
  let emailSent = false;
  let emailError: string | null = null;
  if (template.autoSend) {
    try {
      const result = await deliverRecurringInvoice(invoice.id);
      emailSent = result.recurringDeliveryState === "SENT";
    } catch (error) {
      emailError = error instanceof Error ? error.message : "Versand fehlgeschlagen";
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
  const now = new Date();
  const due = await prisma.recurringInvoice.findMany({
    where: { active: true, nextRun: { lte: now } },
  });
  if (due.length === 0) return { generated: 0, ...(await retryPendingRecurringDeliveries()) };

  const userId = await getSystemUserId();
  if (!userId) return { generated: 0, ...(await retryPendingRecurringDeliveries()) };

  let generated = 0;
  for (const template of due) {
    let nextRun = template.nextRun;
    // Ausfallzeiten nachholen, aber pro Vorlage und Durchlauf begrenzen.
    for (let period = 0; period < 12 && nextRun <= now; period++) {
      try {
        await generateInvoiceFromTemplate(template.id, userId, nextRun);
        generated++;
        nextRun = addInterval(nextRun, template.interval);
      } catch (e) {
        console.error(`Wiederkehrende Rechnung „${template.name}" fehlgeschlagen:`, e);
        break;
      }
    }
  }
  // Auch nach einem Fehler bei der Erzeugung andere offene Versandaufträge prüfen.
  const delivery = await retryPendingRecurringDeliveries();
  return { generated, ...delivery };
}
