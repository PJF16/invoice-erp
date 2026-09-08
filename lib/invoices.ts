import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api-helpers";
import { bookMovementTx, type Tx } from "@/lib/movements";
import { getSettings } from "@/lib/settings";
import { assignInvoiceNumberTx } from "@/lib/document-numbers";
import type { SupplyKind, TaxTreatment } from "@/lib/generated/prisma/enums";
import { assessTaxTreatment } from "@/lib/tax-rules";
import { normalizeVatId } from "@/lib/vat-id";

export const TAX_NOTES: Record<Exclude<TaxTreatment, "STANDARD">, string> = {
  REVERSE_CHARGE: "Steuerschuldnerschaft des Leistungsempfängers (Reverse Charge).",
  INTRA_EU_SUPPLY: "Steuerfreie innergemeinschaftliche Lieferung (Art 6 Abs 1 UStG).",
  EXPORT: "Steuerfreie Ausfuhrlieferung (§ 7 UStG).",
  THIRD_COUNTRY_SERVICE: "Nicht steuerbar in Österreich/EU (Reverse Charge).",
};

export const TAX_TREATMENT_LABELS: Record<TaxTreatment, string> = {
  STANDARD: "Standard (USt)",
  REVERSE_CHARGE: "Reverse Charge (Steuerschuld beim Leistungsempfänger)",
  INTRA_EU_SUPPLY: "Innergemeinschaftliche Lieferung (steuerfrei)",
  EXPORT: "Ausfuhr Drittland (steuerfrei)",
  THIRD_COUNTRY_SERVICE: "B2B-Dienstleistung Drittland (in Österreich nicht steuerbar)",
};

export type LineInput = {
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  taxRate: number;
  supplyKind: SupplyKind;
  softwareItemId?: string | null;
  itemId?: string | null;
  warehouseId?: string | null;
  sourceMovementId?: string | null;
  sourceDeliveryNoteLineId?: string | null;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Berechnet Netto/USt/Brutto. Bei allen Steuerbehandlungen außer STANDARD
 * wird keine österreichische USt berechnet (Reverse Charge, ig. Lieferung, Ausfuhr).
 * Der interne Steuersatz 0 dient nur der Datenkompatibilität und wird nicht als 0% ausgewiesen.
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
  deliveryDate?: Date | null;
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

async function validateSourceDeliveryLines(tx: Tx, input: CreateInvoiceInput) {
  const sourceIds = input.lines.map((line) => line.sourceDeliveryNoteLineId).filter((id): id is string => Boolean(id));
  if (new Set(sourceIds).size !== sourceIds.length) throw new ApiError(400, "Eine Kundenübergabe kann nur einmal verrechnet werden");
  if (sourceIds.length === 0) return sourceIds;
  const deliveryLines = await tx.deliveryNoteLine.findMany({
    where: { id: { in: sourceIds } },
    include: { deliveryNote: true },
  });
  const byId = new Map(deliveryLines.map((line) => [line.id, line]));
  for (const line of input.lines) {
    if (!line.sourceDeliveryNoteLineId) continue;
    const source = byId.get(line.sourceDeliveryNoteLineId);
    if (!source) throw new ApiError(404, "Kundenübergabe nicht gefunden");
    if (source.deliveryNote.status !== "ACTIVE" || source.deliveryNote.customerId !== input.customerId || source.billingStatus !== "PENDING") {
      throw new ApiError(400, "Die Kundenübergabe ist nicht mehr zur Verrechnung verfügbar");
    }
    if (line.softwareItemId || line.itemId !== source.itemId || line.warehouseId !== source.warehouseId || line.quantity !== source.quantity - source.canceledQuantity) {
      throw new ApiError(400, "Artikel und Menge einer Kundenübergabe dürfen nicht verändert werden");
    }
  }
  return sourceIds;
}

async function reserveSourceDeliveryLines(tx: Tx, sourceIds: string[]) {
  if (sourceIds.length === 0) return;
  const updated = await tx.deliveryNoteLine.updateMany({
    where: { id: { in: sourceIds }, billingStatus: "PENDING", deliveryNote: { status: "ACTIVE" } },
    data: { billingStatus: "INVOICED" },
  });
  if (updated.count !== sourceIds.length) throw new ApiError(409, "Eine Kundenübergabe wurde zwischenzeitlich geändert");
  const movements = await tx.deliveryNoteLine.findMany({ where: { id: { in: sourceIds }, movementId: { not: null } }, select: { movementId: true } });
  await tx.movement.updateMany({ where: { id: { in: movements.flatMap((line) => line.movementId ? [line.movementId] : []) } }, data: { billingStatus: "INVOICED" } });
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
    supplyKind: line.supplyKind,
    softwareItemId: line.softwareItemId ?? null,
    itemId: line.itemId ?? null,
    warehouseId: line.warehouseId ?? null,
    sourceMovementId: line.sourceMovementId ?? null,
    sourceDeliveryNoteLineId: line.sourceDeliveryNoteLineId ?? null,
  }));
}

async function resolveReferencedSupplyKinds(tx: Tx, lines: LineInput[]): Promise<LineInput[]> {
  const softwareIds = [...new Set(lines.flatMap((line) => line.softwareItemId ? [line.softwareItemId] : []))];
  const itemIds = [...new Set(lines.flatMap((line) => line.itemId ? [line.itemId] : []))];
  const [softwareItems, items] = await Promise.all([
    tx.softwareItem.findMany({ where: { id: { in: softwareIds } }, select: { id: true, supplyKind: true } }),
    tx.item.findMany({ where: { id: { in: itemIds } }, select: { id: true, supplyKind: true } }),
  ]);
  if (softwareItems.length !== softwareIds.length) throw new ApiError(404, "Softwareartikel nicht gefunden");
  if (items.length !== itemIds.length) throw new ApiError(404, "Hardware-Artikel nicht gefunden");
  const softwareKinds = new Map(softwareItems.map((item) => [item.id, item.supplyKind]));
  const itemKinds = new Map(items.map((item) => [item.id, item.supplyKind]));
  return lines.map((line) => ({
    ...line,
    supplyKind: line.softwareItemId
      ? softwareKinds.get(line.softwareItemId)!
      : line.itemId
        ? itemKinds.get(line.itemId)!
        : line.supplyKind,
  }));
}

export async function createDraftInvoice(input: CreateInvoiceInput) {
  if (input.lines.length === 0) throw new ApiError(400, "Mindestens eine Position ist erforderlich");

  // Skonto aus den Firmeneinstellungen einfrieren — außer bei automatisch aus
  // Vorlagen erzeugten (wiederkehrenden) Rechnungen.
  const settings = input.recurringInvoiceId ? null : await getSettings();
  const skontoPercent = settings?.skontoPercent ?? 0;
  const skontoDays = settings?.skontoDays ?? 0;

  return prisma.$transaction(async (tx) => {
    const resolvedLines = await resolveReferencedSupplyKinds(tx, input.lines);
    const { lines, netTotal, taxTotal, grossTotal } = computeTotals(resolvedLines, input.taxTreatment);
    const sourceIds = await validateSourceMovements(tx, input);
    const deliverySourceIds = await validateSourceDeliveryLines(tx, input);
    // Vor dem Anlegen der Positionen atomar reservieren. So endet ein
    // paralleler Entwurf kontrolliert mit 409 statt an der Unique-Constraint.
    await reserveSourceMovements(tx, sourceIds);
    await reserveSourceDeliveryLines(tx, deliverySourceIds);
    const invoice = await tx.invoice.create({
      data: {
        customerId: input.customerId,
        issueDate: input.issueDate,
        dueDate: input.dueDate,
        deliveryDate: input.deliveryDate ?? null,
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
  return prisma.$transaction(async (tx) => {
    await lockInvoice(tx, invoiceId);
    const existing = await tx.invoice.findUnique({
      where: { id: invoiceId },
      include: { lines: { select: { sourceMovementId: true, sourceDeliveryNoteLineId: true } } },
    });
    if (!existing) throw new ApiError(404, "Rechnung nicht gefunden");
    if (existing.status !== "DRAFT") throw new ApiError(400, "Nur Entwürfe können bearbeitet werden");

    const resolvedLines = await resolveReferencedSupplyKinds(tx, input.lines);
    const { lines, netTotal, taxTotal, grossTotal } = computeTotals(resolvedLines, input.taxTreatment);

    const oldSourceIds = existing.lines
      .map((line) => line.sourceMovementId)
      .filter((id): id is string => Boolean(id));
    if (oldSourceIds.length > 0) {
      await tx.movement.updateMany({ where: { id: { in: oldSourceIds } }, data: { billingStatus: "PENDING" } });
    }
    const oldDeliverySourceIds = existing.lines.map((line) => line.sourceDeliveryNoteLineId).filter((id): id is string => Boolean(id));
    if (oldDeliverySourceIds.length > 0) {
      await tx.deliveryNoteLine.updateMany({ where: { id: { in: oldDeliverySourceIds } }, data: { billingStatus: "PENDING" } });
      const linked = await tx.deliveryNoteLine.findMany({ where: { id: { in: oldDeliverySourceIds }, movementId: { not: null } }, select: { movementId: true } });
      await tx.movement.updateMany({ where: { id: { in: linked.flatMap((line) => line.movementId ? [line.movementId] : []) } }, data: { billingStatus: "PENDING" } });
    }
    await tx.invoiceLine.deleteMany({ where: { invoiceId } });
    const sourceIds = await validateSourceMovements(tx, input);
    const deliverySourceIds = await validateSourceDeliveryLines(tx, input);
    await reserveSourceMovements(tx, sourceIds);
    await reserveSourceDeliveryLines(tx, deliverySourceIds);
    const invoice = await tx.invoice.update({
      where: { id: invoiceId },
      data: {
        customerId: input.customerId,
        issueDate: input.issueDate,
        dueDate: input.dueDate,
        deliveryDate: input.deliveryDate ?? null,
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
      include: { lines: { select: { sourceMovementId: true, sourceDeliveryNoteLineId: true } } },
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
    const deliverySourceIds = existing.lines.map((line) => line.sourceDeliveryNoteLineId).filter((id): id is string => Boolean(id));
    if (deliverySourceIds.length > 0) {
      await tx.deliveryNoteLine.updateMany({ where: { id: { in: deliverySourceIds } }, data: { billingStatus: "PENDING" } });
      const linked = await tx.deliveryNoteLine.findMany({ where: { id: { in: deliverySourceIds }, movementId: { not: null } }, select: { movementId: true } });
      await tx.movement.updateMany({ where: { id: { in: linked.flatMap((line) => line.movementId ? [line.movementId] : []) } }, data: { billingStatus: "PENDING" } });
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
 * Finalisiert einen Entwurf: vergibt die konfigurierte fortlaufende
 * Rechnungsnummer, friert die Kundendaten ein und bucht
 * Hardware-Positionen aus dem Lager aus. Alles in einer Transaktion.
 */
export async function finalizeInvoice(
  invoiceId: string,
  userId: string,
  options: { acknowledgeUidWarning?: boolean; uidCheckOverrideReason?: string | null } = {},
) {
  return prisma.$transaction(async (tx) => {
    await lockInvoice(tx, invoiceId);
    const invoice = await tx.invoice.findUnique({
      where: { id: invoiceId },
      include: { lines: true, customer: true },
    });
    if (!invoice) throw new ApiError(404, "Rechnung nicht gefunden");
    if (invoice.status !== "DRAFT") throw new ApiError(400, "Nur Entwürfe können finalisiert werden");

    const supplyKinds = invoice.lines.map((line) => line.supplyKind);
    const hasGoods = supplyKinds.includes("GOODS");
    const hasServices = supplyKinds.some((kind) => kind === "SERVICE" || kind === "ELECTRONIC_SERVICE");
    if (hasGoods && !invoice.deliveryDate) {
      throw new ApiError(409, "Für Warenpositionen ist ein Lieferdatum erforderlich", "PERFORMANCE_DATE_REQUIRED");
    }
    if (hasServices && (!invoice.servicePeriodStart || !invoice.servicePeriodEnd)) {
      throw new ApiError(409, "Für Dienstleistungen ist ein Leistungszeitraum erforderlich", "PERFORMANCE_DATE_REQUIRED");
    }

    const assessment = assessTaxTreatment({
      customerType: invoice.customer.customerType,
      countryCode: invoice.customer.countryCode,
      uid: invoice.customer.uid,
      supplyKinds,
    });
    if (assessment.reason.startsWith("Waren und Dienstleistungen")) {
      throw new ApiError(409, assessment.reason, "MIXED_TAX_TREATMENTS", { warnings: assessment.warnings });
    }
    if (assessment.expectedTreatment && invoice.taxTreatment !== assessment.expectedTreatment) {
      throw new ApiError(
        409,
        `Die Steuerbehandlung passt nicht zur Konstellation. Erwartet: ${TAX_TREATMENT_LABELS[assessment.expectedTreatment]}.`,
        "TAX_TREATMENT_MISMATCH",
        { expectedTreatment: assessment.expectedTreatment, reason: assessment.reason },
      );
    }

    let vatVerification = null;
    if (assessment.requiresValidUid) {
      const normalized = invoice.customer.uid
        ? normalizeVatId(invoice.customer.uid, invoice.customer.countryCode)
        : null;
      vatVerification = normalized
        ? await tx.vatVerification.findFirst({
            where: {
              customerId: invoice.customerId,
              countryCode: normalized.countryCode,
              vatNumber: normalized.vatNumber,
            },
            orderBy: { checkedAt: "desc" },
          })
        : null;
      if (vatVerification?.status !== "VALID" && !options.acknowledgeUidWarning) {
        const state = vatVerification?.status === "INVALID"
          ? "Die letzte VIES-Prüfung war ungültig."
          : vatVerification?.status === "UNAVAILABLE"
            ? "VIES war bei der letzten Prüfung nicht erreichbar."
            : "Es liegt keine erfolgreiche VIES-Prüfung vor.";
        throw new ApiError(
          409,
          `${state} UID erneut prüfen oder die Rechnung nach manueller Prüfung trotzdem finalisieren.`,
          "UID_CHECK_WARNING",
          { verificationStatus: vatVerification?.status ?? null },
        );
      }
    }

    const number = await assignInvoiceNumberTx(tx, invoice.issueDate);

    for (const line of invoice.lines) {
      if (line.itemId && line.warehouseId && !line.sourceMovementId && !line.sourceDeliveryNoteLineId) {
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
          data: { sourceMovementId: movement.id, stockBookedByInvoice: true },
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
        customerCountryCode: c.countryCode,
        customerType: c.customerType,
        taxDecisionReason: [assessment.reason, ...assessment.warnings].join(" "),
        vatVerificationId: vatVerification?.id ?? null,
        uidCheckOverrideReason: assessment.requiresValidUid && vatVerification?.status !== "VALID"
          ? options.uidCheckOverrideReason?.trim() || "Trotz UID-Warnung nach manueller Prüfung finalisiert."
          : null,
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
      if (line.sourceDeliveryNoteLineId) {
        const source = await tx.deliveryNoteLine.update({
          where: { id: line.sourceDeliveryNoteLineId },
          data: { billingStatus: "PENDING" },
          select: { movementId: true },
        });
        if (source.movementId) await tx.movement.update({ where: { id: source.movementId }, data: { billingStatus: "PENDING" } });
      } else if (line.sourceMovementId && !line.stockBookedByInvoice) {
        await tx.movement.update({ where: { id: line.sourceMovementId }, data: { billingStatus: "PENDING" } });
        await tx.deliveryNoteLine.updateMany({ where: { movementId: line.sourceMovementId }, data: { billingStatus: "PENDING" } });
      } else if (line.itemId && line.warehouseId && line.stockBookedByInvoice) {
        await bookMovementTx(tx, {
          itemId: line.itemId,
          warehouseId: line.warehouseId,
          type: "IN",
          quantity: Math.round(Number(line.quantity)),
          userId,
          note: `Stornorechnung ${number} zu ${invoice.number}`,
        });
        if (line.sourceMovementId) {
          await tx.movement.update({
            where: { id: line.sourceMovementId },
            data: { billingStatus: "CANCELED", canceledAt: now, canceledById: userId, canceledReason: `Stornorechnung ${number}` },
          });
        }
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
        customerCountryCode: invoice.customerCountryCode,
        customerType: invoice.customerType,
        issueDate: now,
        dueDate: now,
        deliveryDate: invoice.deliveryDate,
        servicePeriodStart: invoice.servicePeriodStart,
        servicePeriodEnd: invoice.servicePeriodEnd,
        taxTreatment: invoice.taxTreatment,
        taxDecisionReason: invoice.taxDecisionReason,
        vatVerificationId: invoice.vatVerificationId,
        uidCheckOverrideReason: invoice.uidCheckOverrideReason,
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
            supplyKind: line.supplyKind,
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
