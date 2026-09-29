import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api-helpers";
import { getSettings, isSmtpConfigured } from "@/lib/settings";
import { renderInvoicePdf } from "@/lib/invoice-pdf";
import { sendMonitoredMail, fillMailTemplate } from "@/lib/mail-transport";

/** Ein einzelner SMTP-Versuch. Die Versandwarteschlange liegt auf der Rechnung. */
async function sendInvoiceEmailCore(invoiceId: string) {
  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId }, include: { lines: true, customer: true } });
  if (!invoice) throw new ApiError(404, "Rechnung nicht gefunden");
  if (invoice.status === "DRAFT" || !invoice.number) throw new ApiError(400, "Rechnung muss zuerst finalisiert werden");
  if (invoice.status === "CANCELED") throw new ApiError(400, "Stornierte Rechnungen können nicht versendet werden");
  if (!invoice.customer.email) throw new ApiError(400, `Kunde „${invoice.customer.name}" hat keine E-Mail-Adresse`);

  const settings = await getSettings();
  const pdf = await renderInvoicePdf(invoice, settings);
  const vars = { nummer: invoice.number, kunde: invoice.customerName || invoice.customer.name };
  const subject = fillMailTemplate(settings.emailSubject, vars);
  await sendMonitoredMail({ kind: "INVOICE", recipient: invoice.customer.email, subject, invoiceId }, {
    to: invoice.customer.email, subject, text: fillMailTemplate(settings.emailBody, vars),
    attachments: [{ filename: `Rechnung_${invoice.number.replace(/[^\w-]/g, "_")}.pdf`, content: pdf, contentType: "application/pdf" }],
  });
  await prisma.invoice.updateMany({ where: { id: invoiceId, status: "OPEN" }, data: { status: "SENT" } });
  return prisma.invoice.update({ where: { id: invoiceId }, data: { sentAt: new Date(), recurringDeliveryState: invoice.recurringDeliveryState ? "SENT" : undefined, recurringDeliveryRetryAt: null, recurringDeliveryError: null } });
}

const successfulMail = (invoiceId: string, since?: Date) => prisma.mailEvent.findFirst({
  where: { invoiceId, kind: "INVOICE", status: { in: ["ACCEPTED", "SIMULATED"] }, ...(since ? { createdAt: { gte: since } } : {}) },
  orderBy: { createdAt: "desc" }, select: { id: true },
});

/** Ein nachweislich angenommener Versand wird niemals automatisch wiederholt. */
async function reconcileAcceptedMail(invoiceId: string, since?: Date) {
  if (!await successfulMail(invoiceId, since)) return null;
  await prisma.invoice.updateMany({ where: { id: invoiceId, status: "OPEN" }, data: { status: "SENT" } });
  return prisma.invoice.update({ where: { id: invoiceId }, data: { sentAt: new Date(), recurringDeliveryState: "SENT", recurringDeliveryError: null, recurringDeliveryRetryAt: null } });
}

/** Beansprucht eine wiederkehrende Rechnung atomar. Unklare SMTP-Versuche gehen in REVIEW. */
export async function deliverRecurringInvoice(invoiceId: string, options: { manual?: boolean } = {}) {
  const existing = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!existing) throw new ApiError(404, "Rechnung nicht gefunden");
  if (!existing.recurringDeliveryState) throw new ApiError(400, "Kein automatischer Versandauftrag vorhanden");
  if (existing.status === "DRAFT" || existing.status === "CANCELED") throw new ApiError(400, "Diese Rechnung kann nicht versendet werden");
  if (existing.recurringDeliveryState === "SENDING") throw new ApiError(409, "Der Versand läuft bereits");
  if (!options.manual) {
    if (existing.recurringDeliveryState === "SENT") return existing;
    const accepted = await reconcileAcceptedMail(invoiceId);
    if (accepted) return accepted;
  }
  const now = new Date();
  const claimed = await prisma.invoice.updateMany({
    where: { id: invoiceId, recurringDeliveryState: { in: options.manual ? ["PENDING", "FAILED", "REVIEW", "SENT"] : ["PENDING", "FAILED"] }, status: { in: ["OPEN", "SENT", "PAID"] },
      ...(!options.manual ? { OR: [{ recurringDeliveryRetryAt: null }, { recurringDeliveryRetryAt: { lte: now } }] } : {}) },
    data: { recurringDeliveryState: "SENDING", recurringDeliveryStartedAt: now, recurringDeliveryAttempts: { increment: 1 }, recurringDeliveryRetryAt: null, recurringDeliveryError: null },
  });
  if (claimed.count !== 1) throw new ApiError(409, "Der Versand wurde bereits übernommen oder ist noch nicht wieder fällig");
  try {
    return await sendInvoiceEmailCore(invoiceId);
  } catch (error) {
    // Falls der SMTP-Server angenommen hat und nur die spätere DB-Aktualisierung
    // fehlschlug, zuerst den vorhandenen Zustellnachweis auswerten.
    const accepted = await reconcileAcceptedMail(invoiceId, now).catch(() => null);
    if (accepted) return accepted;
    const lastEvent = await prisma.mailEvent.findFirst({ where: { invoiceId, kind: "INVOICE", createdAt: { gte: now } }, orderBy: { createdAt: "desc" }, select: { status: true } }).catch(() => null);
    const uncertain = lastEvent?.status === "PENDING" || lastEvent?.status === "PARTIALLY_REJECTED";
    const attempts = existing.recurringDeliveryAttempts + 1;
    const delay = Math.min(24 * 60, 5 * 3 ** Math.min(attempts - 1, 6)) * 60_000;
    await prisma.invoice.update({ where: { id: invoiceId }, data: {
      recurringDeliveryState: uncertain ? "REVIEW" : "FAILED",
      recurringDeliveryRetryAt: uncertain ? null : new Date(Date.now() + delay),
      recurringDeliveryError: (error instanceof Error ? error.message : "Versand fehlgeschlagen").slice(0, 1000),
    } });
    throw error;
  }
}

/** Manuelles Senden nutzt für Abo-Rechnungen dieselbe Versand-Sperre. */
export async function sendInvoiceEmail(invoiceId: string) {
  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId }, select: { recurringDeliveryState: true } });
  if (!invoice) throw new ApiError(404, "Rechnung nicht gefunden");
  return invoice.recurringDeliveryState ? deliverRecurringInvoice(invoiceId, { manual: true }) : sendInvoiceEmailCore(invoiceId);
}

/** Beim Serverstart und stündlich fehlgeschlagene, eindeutig nicht zugestellte Mails nachholen. */
export async function retryPendingRecurringDeliveries() {
  const staleBefore = new Date(Date.now() - 5 * 60_000);
  const staleClaims = await prisma.invoice.findMany({ where: { recurringDeliveryState: "SENDING", recurringDeliveryStartedAt: { lt: staleBefore } }, select: { id: true, recurringDeliveryStartedAt: true } });
  for (const claim of staleClaims) await reconcileAcceptedMail(claim.id, claim.recurringDeliveryStartedAt ?? undefined);
  const stale = await prisma.invoice.updateMany({ where: { recurringDeliveryState: "SENDING", recurringDeliveryStartedAt: { lt: staleBefore } }, data: {
    recurringDeliveryState: "REVIEW", recurringDeliveryRetryAt: null,
    recurringDeliveryError: "Der Versand wurde unterbrochen. Bitte den Mail-Monitoring-Eintrag prüfen, bevor erneut gesendet wird.",
  } });
  const now = new Date();
  const pending = await prisma.invoice.findMany({ where: { recurringDeliveryState: { in: ["PENDING", "FAILED"] }, status: { in: ["OPEN", "SENT", "PAID"] }, OR: [{ recurringDeliveryRetryAt: null }, { recurringDeliveryRetryAt: { lte: now } }] }, orderBy: { createdAt: "asc" }, take: 50, select: { id: true, number: true } });
  let sent = 0; let failed = 0;
  for (const invoice of pending) {
    try { await deliverRecurringInvoice(invoice.id); sent++; }
    catch (error) { failed++; console.error(`Automatischer Versand für ${invoice.number ?? invoice.id} fehlgeschlagen:`, error); }
  }
  return { sent, failed, review: stale.count };
}

export { isSmtpConfigured };
