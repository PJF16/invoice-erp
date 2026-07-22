import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api-helpers";
import { bookMovementTx, type Tx } from "@/lib/movements";
import { getSettings } from "@/lib/settings";
import { assignInvoiceNumberTx } from "@/lib/document-numbers";
import type { TaxTreatment } from "@/lib/generated/prisma/enums";

export const TAX_NOTES: Record<Exclude<TaxTreatment, "STANDARD">, string> = {
  REVERSE_CHARGE:
    "Übergang der Steuerschuld auf den Leistungsempfänger (Reverse Charge, § 19 UStG / Art 196 MwSt-RL).",
  INTRA_EU_SUPPLY: "Steuerfreie innergemeinschaftliche Lieferung (Art 6 Abs 1 UStG).",
  EXPORT: "Steuerfreie Ausfuhrlieferung (§ 7 UStG).",
};

export const TAX_TREATMENT_LABELS: Record<TaxTreatment, string> = {
  STANDARD: "Standard (USt)",
  REVERSE_CHARGE: "Reverse Charge (EU-B2B)",
  INTRA_EU_SUPPLY: "Innergem. Lieferung (0%)",
  EXPORT: "Ausfuhr Drittland (0%)",
};

export type LineInput = {
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  taxRate: number;
  softwareItemId?: string | null;
  itemId?: string | null;
  warehouseId?: string | null;
  sourceMovementId?: string | null;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Berechnet Netto/USt/Brutto. Bei allen Steuerbehandlungen außer STANDARD
 * werden sämtliche Positionen mit 0% gerechnet (Reverse Charge, ig. Lieferung, Ausfuhr).
 */
export function computeTotals(lines: LineInput[], treatment: TaxTreatment) {
  const effective = lines.map((line) => ({
    ...line,
    taxRate: treatment === "STANDARD" ? line.taxRate : 0,
    lineNet: round2(line.quantity * line.unitPrice),
  }));

  const netTotal = round2(effective.reduce((sum, l) => sum + l.lineNet, 0));
  const byRate = new Map<number, number>();
  for (const line of effective) {
    byRate.set(line.taxRate, round2((byRate.get(line.taxRate) ?? 0) + line.lineNet));
  }
  const taxBreakdown = [...byRate.entries()]
    .filter(([rate]) => rate > 0)
    .sort((a, b) => b[0] - a[0])
    .map(([rate, net]) => ({ rate, net, tax: round2((net * rate) / 100) }));
  const taxTotal = round2(taxBreakdown.reduce((sum, t) => sum + t.tax, 0));

  return { lines: effective, netTotal, taxTotal, grossTotal: round2(netTotal + taxTotal), taxBreakdown };
}

type CreateInvoiceInput = {
  customerId: string;
  issueDate: Date;
  dueDate: Date;
  servicePeriodStart?: Date | null;
  servicePeriodEnd?: Date | null;
  taxTreatment: TaxTreatment;
  notes?: string | null;
  lines: LineInput[];
  recurringInvoiceId?: string | null;
};

async function lockInvoice(tx: Tx, invoiceId: string) {
  await tx.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "Invoice" WHERE "id" = ${invoiceId} FOR UPDATE
  `;
}

async function validateSourceMovements(tx: Tx, input: CreateInvoiceInput) {
  const sourceIds = input.lines
    .map((line) => line.sourceMovementId)
    .filter((id): id is string => Boolean(id));
  if (new Set(sourceIds).size !== sourceIds.length) {
    throw new ApiError(400, "Eine Kundenübergabe kann nur einmal verrechnet werden");
  }
  if (sourceIds.length === 0) return sourceIds;

  const movements = await tx.movement.findMany({ where: { id: { in: sourceIds } } });
  const byId = new Map(movements.map((movement) => [movement.id, movement]));
  for (const line of input.lines) {
    if (!line.sourceMovementId) continue;
    const movement = byId.get(line.sourceMovementId);
    if (!movement) throw new ApiError(404, "Kundenübergabe nicht gefunden");
    if (
      movement.type !== "OUT" ||
      movement.customerId !== input.customerId ||
      movement.billingStatus !== "PENDING"
    ) {
      throw new ApiError(400, "Die Kundenübergabe ist nicht mehr zur Verrechnung verfügbar");
    }
    if (
      line.softwareItemId ||
      line.itemId !== movement.itemId ||
      line.warehouseId !== movement.warehouseId ||
      line.quantity !== Math.abs(movement.quantity)
    ) {
      throw new ApiError(400, "Artikel und Menge einer Kundenübergabe dürfen nicht verändert werden");
    }
  }
  return sourceIds;
}

async function reserveSourceMovements(tx: Tx, sourceIds: string[]) {
  if (sourceIds.length === 0) return;
  const updated = await tx.movement.updateMany({
    where: { id: { in: sourceIds }, billingStatus: "PENDING" },
    data: { billingStatus: "INVOICED" },
  });
  if (updated.count !== sourceIds.length) {
    throw new ApiError(409, "Eine Kundenübergabe wurde zwischenzeitlich geändert");
  }
}

function invoiceLinesData(lines: ReturnType<typeof computeTotals>["lines"]) {
  return lines.map((line, i) => ({
    position: i + 1,
    description: line.description,
    quantity: line.quantity,
    unit: line.unit,
    unitPrice: line.unitPrice,
    taxRate: line.taxRate,
    lineNet: line.lineNet,
    softwareItemId: line.softwareItemId ?? null,
    itemId: line.itemId ?? null,
    warehouseId: line.warehouseId ?? null,
    sourceMovementId: line.sourceMovementId ?? null,
  }));
}

export async function createDraftInvoice(input: CreateInvoiceInput) {
  if (input.lines.length === 0) throw new ApiError(400, "Mindestens eine Position ist erforderlich");
  const { lines, netTotal, taxTotal, grossTotal } = computeTotals(input.lines, input.taxTreatment);

  // Skonto aus den Firmeneinstellungen einfrieren — außer bei automatisch aus
  // Vorlagen erzeugten (wiederkehrenden) Rechnungen.
  const settings = input.recurringInvoiceId ? null : await getSettings();
  const skontoPercent = settings?.skontoPercent ?? 0;
  const skontoDays = settings?.skontoDays ?? 0;

  return prisma.$transaction(async (tx) => {
    const sourceIds = await validateSourceMovements(tx, input);
    // Vor dem Anlegen der Positionen atomar reservieren. So endet ein
    // paralleler Entwurf kontrolliert mit 409 statt an der Unique-Constraint.
    await reserveSourceMovements(tx, sourceIds);
    const invoice = await tx.invoice.create({
      data: {
        customerId: input.customerId,
        issueDate: input.issueDate,
        dueDate: input.dueDate,
        servicePeriodStart: input.servicePeriodStart ?? null,
        servicePeriodEnd: input.servicePeriodEnd ?? null,
        taxTreatment: input.taxTreatment,
        notes: input.notes ?? null,
        recurringInvoiceId: input.recurringInvoiceId ?? null,
        netTotal,
        taxTotal,
        grossTotal,
        skontoPercent,
        skontoDays,
        lines: { create: invoiceLinesData(lines) },
      },
      include: { lines: true },
    });
    return invoice;
  });
}

export async function updateDraftInvoice(invoiceId: string, input: CreateInvoiceInput) {
  if (input.lines.length === 0) throw new ApiError(400, "Mindestens eine Position ist erforderlich");
  const { lines, netTotal, taxTotal, grossTotal } = computeTotals(input.lines, input.taxTreatment);
  return prisma.$transaction(async (tx) => {
    await lockInvoice(tx, invoiceId);
    const existing = await tx.invoice.findUnique({
      where: { id: invoiceId },
      include: { lines: { select: { sourceMovementId: true } } },
    });
    if (!existing) throw new ApiError(404, "Rechnung nicht gefunden");
    if (existing.status !== "DRAFT") throw new ApiError(400, "Nur Entwürfe können bearbeitet werden");

    const oldSourceIds = existing.lines
      .map((line) => line.sourceMovementId)
      .filter((id): id is string => Boolean(id));
    if (oldSourceIds.length > 0) {
      await tx.movement.updateMany({ where: { id: { in: oldSourceIds } }, data: { billingStatus: "PENDING" } });
    }
    await tx.invoiceLine.deleteMany({ where: { invoiceId } });
    const sourceIds = await validateSourceMovements(tx, input);
    await reserveSourceMovements(tx, sourceIds);
    const invoice = await tx.invoice.update({
      where: { id: invoiceId },
      data: {
        customerId: input.customerId,
        issueDate: input.issueDate,
        dueDate: input.dueDate,
        servicePeriodStart: input.servicePeriodStart ?? null,
        servicePeriodEnd: input.servicePeriodEnd ?? null,
        taxTreatment: input.taxTreatment,
        notes: input.notes ?? null,
        netTotal,
        taxTotal,
        grossTotal,
        lines: { create: invoiceLinesData(lines) },
      },
      include: { lines: true },
    });
    return invoice;
  });
}

export async function deleteDraftInvoice(invoiceId: string) {
  return prisma.$transaction(async (tx) => {
    await lockInvoice(tx, invoiceId);
    const existing = await tx.invoice.findUnique({
      where: { id: invoiceId },
      include: { lines: { select: { sourceMovementId: true } } },
    });
    if (!existing) throw new ApiError(404, "Rechnung nicht gefunden");
    if (existing.status !== "DRAFT") {
      throw new ApiError(400, "Nur Entwürfe können gelöscht werden — finalisierte Rechnungen stornieren");
    }
    const sourceIds = existing.lines
      .map((line) => line.sourceMovementId)
      .filter((id): id is string => Boolean(id));
    if (sourceIds.length > 0) {
      await tx.movement.updateMany({ where: { id: { in: sourceIds } }, data: { billingStatus: "PENDING" } });
    }
    if (existing.sourceOfferId) {
      await tx.offer.update({
        where: { id: existing.sourceOfferId },
        data: { status: "ACCEPTED", convertedAt: null },
      });
    }
    await tx.invoice.delete({ where: { id: invoiceId } });
  });
}

/**
 * Finalisiert einen Entwurf: vergibt die fortlaufende Rechnungsnummer
 * ({Präfix}{Jahr}-{lfd. Nr}), friert die Kundendaten ein und bucht
 * Hardware-Positionen aus dem Lager aus. Alles in einer Transaktion.
 */
export async function finalizeInvoice(invoiceId: string, userId: string) {
  return prisma.$transaction(async (tx) => {
    await lockInvoice(tx, invoiceId);
    const invoice = await tx.invoice.findUnique({
      where: { id: invoiceId },
      include: { lines: true, customer: true },
    });
    if (!invoice) throw new ApiError(404, "Rechnung nicht gefunden");
    if (invoice.status !== "DRAFT") throw new ApiError(400, "Nur Entwürfe können finalisiert werden");

    const number = await assignInvoiceNumberTx(tx, invoice.issueDate);

    for (const line of invoice.lines) {
      if (line.itemId && line.warehouseId && !line.sourceMovementId) {
        const { movement } = await bookMovementTx(tx, {
          itemId: line.itemId,
          warehouseId: line.warehouseId,
          type: "OUT",
          quantity: Math.round(Number(line.quantity)),
          userId,
          customerId: invoice.customerId,
          billingStatus: "INVOICED",
          note: `Rechnung ${number}`,
        });
        await tx.invoiceLine.update({
          where: { id: line.id },
          data: { sourceMovementId: movement.id },
        });
      }
    }

    const c = invoice.customer;
    return tx.invoice.update({
      where: { id: invoiceId },
      data: {
        number,
        status: "OPEN",
        customerName: c.name,
        customerAddress: [c.street, `${c.zip} ${c.city}`.trim(), c.country]
          .filter(Boolean)
          .join("\n"),
        customerUid: c.uid,
      },
      include: { lines: true, customer: true },
    });
  });
}

/**
 * Storniert eine Rechnung buchhalterisch korrekt: erzeugt eine Stornorechnung
 * (eigener Beleg mit eigener Nummer und negierten Beträgen), bucht ausgebuchte
 * Hardware zurück ins Lager und setzt die Originalrechnung auf CANCELED.
 */
export async function createStornoInvoice(invoiceId: string, userId: string) {
  return prisma.$transaction(async (tx) => {
    await lockInvoice(tx, invoiceId);
    const invoice = await tx.invoice.findUnique({
      where: { id: invoiceId },
      include: { lines: true, stornoInvoices: true },
    });
    if (!invoice) throw new ApiError(404, "Rechnung nicht gefunden");
    if (invoice.type !== "INVOICE") throw new ApiError(400, "Stornorechnungen können nicht storniert werden");
    if (invoice.status === "DRAFT") throw new ApiError(400, "Entwürfe können gelöscht statt storniert werden");
    if (invoice.status === "CANCELED" || invoice.stornoInvoices.length > 0) {
      throw new ApiError(400, "Rechnung ist bereits storniert");
    }

    const now = new Date();
    const number = await assignInvoiceNumberTx(tx, now);

    for (const line of invoice.lines) {
      if (line.itemId && line.warehouseId) {
        await bookMovementTx(tx, {
          itemId: line.itemId,
          warehouseId: line.warehouseId,
          type: "IN",
          quantity: Math.round(Number(line.quantity)),
          userId,
          note: `Stornorechnung ${number} zu ${invoice.number}`,
        });
      }
    }

    const storno = await tx.invoice.create({
      data: {
        number,
        type: "CREDIT_NOTE",
        relatedInvoiceId: invoice.id,
        status: "OPEN",
        customerId: invoice.customerId,
        customerName: invoice.customerName,
        customerAddress: invoice.customerAddress,
        customerUid: invoice.customerUid,
        issueDate: now,
        dueDate: now,
        servicePeriodStart: invoice.servicePeriodStart,
        servicePeriodEnd: invoice.servicePeriodEnd,
        taxTreatment: invoice.taxTreatment,
        notes: `Storno zu Rechnung ${invoice.number} vom ${new Intl.DateTimeFormat("de-AT", { dateStyle: "medium" }).format(invoice.issueDate)}.`,
        netTotal: -Number(invoice.netTotal),
        taxTotal: -Number(invoice.taxTotal),
        grossTotal: -Number(invoice.grossTotal),
        lines: {
          create: invoice.lines.map((line) => ({
            position: line.position,
            description: line.description,
            quantity: Number(line.quantity),
            unit: line.unit,
            unitPrice: -Number(line.unitPrice),
            taxRate: line.taxRate,
            lineNet: -Number(line.lineNet),
            softwareItemId: line.softwareItemId,
            itemId: line.itemId,
            warehouseId: line.warehouseId,
          })),
        },
      },
    });

    await tx.invoice.update({ where: { id: invoiceId }, data: { status: "CANCELED" } });
    return storno;
  });
}
