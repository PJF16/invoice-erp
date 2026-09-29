import { prisma } from "@/lib/prisma";
import { lockInvoice } from "@/lib/locks";
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
  bankTransactionId?: string;
};

async function payableInvoice(tx: Tx, invoiceId: string) {
  const invoice = await tx.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) throw new ApiError(404, "Rechnung nicht gefunden");
  if (invoice.type !== "INVOICE") throw new ApiError(400, "Für Stornorechnungen können keine Zahlungen erfasst werden");
  if (!invoice.number || invoice.status === "DRAFT") throw new ApiError(400, "Zahlungen können nur für finalisierte Rechnungen erfasst werden");
  if (invoice.status === "CANCELED") throw new ApiError(400, "Für stornierte Rechnungen können keine Zahlungen geändert werden");
  return invoice;
}

async function recordPaymentTx(tx: Tx, invoiceId: string, input: PaymentInput, userId: string) {
  const invoice = await payableInvoice(tx, invoiceId);
  if (!Number.isFinite(input.amount) || input.amount <= 0) throw new ApiError(400, "Betrag muss größer als 0 sein");
  if (input.grantSkonto !== undefined) {
    const skonto = input.grantSkonto ? skontoAmount(invoice) : 0;
    if (input.grantSkonto && skonto <= 0) throw new ApiError(400, "Für diese Rechnung ist kein Skonto hinterlegt");
    await tx.invoice.update({ where: { id: invoiceId }, data: { skontoGranted: skonto } });
  }
  await tx.payment.create({ data: {
    invoiceId, amount: input.amount, date: input.date, method: input.method,
    reference: input.reference ?? null, note: input.note ?? null, userId,
    bankTransactionId: input.bankTransactionId,
  } });
  return recomputeInvoiceSettlement(tx, invoiceId);
}

/** Zahlung und Saldo unter derselben Sperre wie Finalisierung und Storno. */
export async function recordPayment(invoiceId: string, input: PaymentInput, userId: string) {
  return prisma.$transaction(async (tx) => {
    await lockInvoice(tx, invoiceId);
    return recordPaymentTx(tx, invoiceId, input, userId);
  });
}

export async function deletePayment(paymentId: string) {
  return prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({ where: { id: paymentId } });
    if (!payment) throw new ApiError(404, "Zahlung nicht gefunden");
    await lockInvoice(tx, payment.invoiceId);
    await payableInvoice(tx, payment.invoiceId);
    await tx.payment.delete({ where: { id: paymentId } });
    const remaining = await tx.payment.count({ where: { invoiceId: payment.invoiceId } });
    if (remaining === 0) await tx.invoice.update({ where: { id: payment.invoiceId }, data: { skontoGranted: 0 } });
    return recomputeInvoiceSettlement(tx, payment.invoiceId);
  });
}

/** Wiederholte gleichzeitige Aufrufe begleichen nur den tatsächlich offenen Rest. */
export async function settleFully(invoiceId: string, userId: string) {
  return prisma.$transaction(async (tx) => {
    await lockInvoice(tx, invoiceId);
    await payableInvoice(tx, invoiceId);
    const invoice = await recomputeInvoiceSettlement(tx, invoiceId);
    const remaining = openAmount(invoice);
    if (remaining <= 0) return invoice;
    return recordPaymentTx(tx, invoiceId, { amount: remaining, date: new Date(), method: "BANK_TRANSFER" }, userId);
  });
}

export async function clearPayments(invoiceId: string) {
  return prisma.$transaction(async (tx) => {
    await lockInvoice(tx, invoiceId);
    await payableInvoice(tx, invoiceId);
    await tx.payment.deleteMany({ where: { invoiceId } });
    await tx.invoice.update({ where: { id: invoiceId }, data: { skontoGranted: 0 } });
    return recomputeInvoiceSettlement(tx, invoiceId);
  });
}
