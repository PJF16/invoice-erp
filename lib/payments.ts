import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api-helpers";
import type { Prisma } from "@/lib/generated/prisma/client";
import type { PaymentMethod } from "@/lib/generated/prisma/enums";

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

const round2 = (n: number) => Math.round(n * 100) / 100;
const cents = (n: number) => Math.round(n * 100);

/** Skontobetrag einer Rechnung (0, wenn kein Skonto hinterlegt). */
export function skontoAmount(invoice: { grossTotal: Prisma.Decimal | number; skontoPercent: number }) {
  return round2((Number(invoice.grossTotal) * invoice.skontoPercent) / 100);
}

/** Skonto-Frist (Rechnungsdatum + skontoDays) oder null, wenn kein Skonto aktiv. */
export function skontoDeadline(invoice: { issueDate: Date; skontoPercent: number; skontoDays: number }) {
  if (invoice.skontoPercent <= 0 || invoice.skontoDays <= 0) return null;
  return new Date(invoice.issueDate.getTime() + invoice.skontoDays * 86_400_000);
}

/** Noch offener Restbetrag: Brutto − bereits gezahlt − gewährtes Skonto. */
export function openAmount(invoice: {
  grossTotal: Prisma.Decimal | number;
  paidTotal: Prisma.Decimal | number;
  skontoGranted: Prisma.Decimal | number;
}) {
  return round2(Number(invoice.grossTotal) - Number(invoice.paidTotal) - Number(invoice.skontoGranted));
}

/**
 * Setzt paidTotal sowie — sofern nicht Entwurf/storniert — Status und paidAt
 * anhand der erfassten Zahlungen (zzgl. gewährtem Skonto) neu. Einziger Ort,
 * der den Bezahlt-Status einer Rechnung schreibt.
 */
async function recomputeInvoiceSettlement(tx: Tx, invoiceId: string) {
  const invoice = await tx.invoice.findUnique({
    where: { id: invoiceId },
    include: { payments: true },
  });
  if (!invoice) throw new ApiError(404, "Rechnung nicht gefunden");

  const paidSum = round2(invoice.payments.reduce((sum, p) => sum + Number(p.amount), 0));
  const settled = round2(paidSum + Number(invoice.skontoGranted));
  const gross = Number(invoice.grossTotal);

  const data: Prisma.InvoiceUpdateInput = { paidTotal: paidSum };
  if (invoice.status !== "DRAFT" && invoice.status !== "CANCELED") {
    if (gross > 0 && cents(settled) >= cents(gross)) {
      const lastDate = invoice.payments.reduce<Date | null>(
        (max, p) => (!max || p.date > max ? p.date : max),
        null,
      );
      data.status = "PAID";
      data.paidAt = lastDate ?? new Date();
    } else {
      data.status = invoice.sentAt ? "SENT" : "OPEN";
      data.paidAt = null;
    }
  }

  return tx.invoice.update({ where: { id: invoiceId }, data });
}

type PaymentInput = {
  amount: number;
  date: Date;
  method: PaymentMethod;
  reference?: string | null;
  note?: string | null;
  grantSkonto?: boolean;
};

/** Erfasst eine Zahlung zu einer finalisierten Rechnung und aktualisiert den Bezahlt-Status. */
export async function recordPayment(invoiceId: string, input: PaymentInput, userId: string) {
  return prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) throw new ApiError(404, "Rechnung nicht gefunden");
    if (invoice.type !== "INVOICE") {
      throw new ApiError(400, "Für Stornorechnungen können keine Zahlungen erfasst werden");
    }
    if (!invoice.number || invoice.status === "DRAFT") {
      throw new ApiError(400, "Zahlungen können nur für finalisierte Rechnungen erfasst werden");
    }
    if (invoice.status === "CANCELED") {
      throw new ApiError(400, "Für stornierte Rechnungen können keine Zahlungen erfasst werden");
    }

    if (input.grantSkonto !== undefined) {
      const skonto = input.grantSkonto ? skontoAmount(invoice) : 0;
      if (input.grantSkonto && skonto <= 0) {
        throw new ApiError(400, "Für diese Rechnung ist kein Skonto hinterlegt");
      }
      await tx.invoice.update({ where: { id: invoiceId }, data: { skontoGranted: skonto } });
    }

    await tx.payment.create({
      data: {
        invoiceId,
        amount: input.amount,
        date: input.date,
        method: input.method,
        reference: input.reference ?? null,
        note: input.note ?? null,
        userId,
      },
    });

    return recomputeInvoiceSettlement(tx, invoiceId);
  });
}

/** Löscht eine Zahlung und aktualisiert den Bezahlt-Status; gewährtes Skonto entfällt mit der letzten Zahlung. */
export async function deletePayment(paymentId: string) {
  return prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({ where: { id: paymentId } });
    if (!payment) throw new ApiError(404, "Zahlung nicht gefunden");

    await tx.payment.delete({ where: { id: paymentId } });

    const remaining = await tx.payment.count({ where: { invoiceId: payment.invoiceId } });
    if (remaining === 0) {
      await tx.invoice.update({ where: { id: payment.invoiceId }, data: { skontoGranted: 0 } });
    }

    return recomputeInvoiceSettlement(tx, payment.invoiceId);
  });
}

/** Bucht den offenen Restbetrag als Zahlung ein (für „Als bezahlt markieren"). */
export async function settleFully(invoiceId: string, userId: string) {
  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) throw new ApiError(404, "Rechnung nicht gefunden");
  const remaining = openAmount(invoice);
  if (remaining <= 0) {
    return prisma.$transaction((tx) => recomputeInvoiceSettlement(tx, invoiceId));
  }
  return recordPayment(
    invoiceId,
    { amount: remaining, date: new Date(), method: "BANK_TRANSFER" },
    userId,
  );
}

/** Entfernt alle Zahlungen und setzt die Rechnung auf offen (für „Bezahlt-Status zurücksetzen"). */
export async function clearPayments(invoiceId: string) {
  return prisma.$transaction(async (tx) => {
    await tx.payment.deleteMany({ where: { invoiceId } });
    await tx.invoice.update({ where: { id: invoiceId }, data: { skontoGranted: 0 } });
    return recomputeInvoiceSettlement(tx, invoiceId);
  });
}
