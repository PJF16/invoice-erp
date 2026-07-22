import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api-helpers";
import { computeTotals, type LineInput } from "@/lib/invoices";
import { assignOfferNumberTx } from "@/lib/document-numbers";
import type { OfferStatus, TaxTreatment } from "@/lib/generated/prisma/enums";
import type { Tx } from "@/lib/movements";

export type OfferInput = {
  customerId: string;
  issueDate: Date;
  validUntil: Date;
  taxTreatment: TaxTreatment;
  notes?: string | null;
  lines: Omit<LineInput, "sourceMovementId">[];
};

async function lockOffer(tx: Tx, offerId: string) {
  await tx.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "Offer" WHERE "id" = ${offerId} FOR UPDATE
  `;
}

async function validateReferences(tx: Tx, input: OfferInput) {
  const softwareIds = [...new Set(input.lines.flatMap((line) => line.softwareItemId ? [line.softwareItemId] : []))];
  const itemIds = [...new Set(input.lines.flatMap((line) => line.itemId ? [line.itemId] : []))];
  const warehouseIds = [...new Set(input.lines.flatMap((line) => line.warehouseId ? [line.warehouseId] : []))];
  const [customer, softwareCount, itemCount, warehouseCount] = await Promise.all([
    tx.customer.findUnique({ where: { id: input.customerId }, select: { id: true } }),
    tx.softwareItem.count({ where: { id: { in: softwareIds } } }),
    tx.item.count({ where: { id: { in: itemIds } } }),
    tx.warehouse.count({ where: { id: { in: warehouseIds } } }),
  ]);
  if (!customer) throw new ApiError(404, "Kunde nicht gefunden");
  if (softwareCount !== softwareIds.length) throw new ApiError(404, "Softwareartikel nicht gefunden");
  if (itemCount !== itemIds.length) throw new ApiError(404, "Hardware-Artikel nicht gefunden");
  if (warehouseCount !== warehouseIds.length) throw new ApiError(404, "Lager nicht gefunden");
}

function totalsAndLines(input: OfferInput) {
  const totals = computeTotals(input.lines, input.taxTreatment);
  return {
    ...totals,
    linesData: totals.lines.map((line, index) => ({
      position: index + 1,
      description: line.description,
      quantity: line.quantity,
      unit: line.unit,
      unitPrice: line.unitPrice,
      taxRate: line.taxRate,
      lineNet: line.lineNet,
      softwareItemId: line.softwareItemId ?? null,
      itemId: line.itemId ?? null,
      warehouseId: line.warehouseId ?? null,
    })),
  };
}

export async function createDraftOffer(input: OfferInput) {
  const { netTotal, taxTotal, grossTotal, linesData } = totalsAndLines(input);
  return prisma.$transaction(async (tx) => {
    await validateReferences(tx, input);
    return tx.offer.create({
      data: {
        customerId: input.customerId,
        issueDate: input.issueDate,
        validUntil: input.validUntil,
        taxTreatment: input.taxTreatment,
        notes: input.notes ?? null,
        netTotal,
        taxTotal,
        grossTotal,
        lines: { create: linesData },
      },
      include: { lines: true },
    });
  });
}

export async function updateDraftOffer(offerId: string, input: OfferInput) {
  const { netTotal, taxTotal, grossTotal, linesData } = totalsAndLines(input);
  return prisma.$transaction(async (tx) => {
    await lockOffer(tx, offerId);
    const offer = await tx.offer.findUnique({ where: { id: offerId }, select: { status: true } });
    if (!offer) throw new ApiError(404, "Angebot nicht gefunden");
    if (offer.status !== "DRAFT") throw new ApiError(400, "Nur Entwürfe können bearbeitet werden");
    await validateReferences(tx, input);
    await tx.offerLine.deleteMany({ where: { offerId } });
    return tx.offer.update({
      where: { id: offerId },
      data: {
        customerId: input.customerId,
        issueDate: input.issueDate,
        validUntil: input.validUntil,
        taxTreatment: input.taxTreatment,
        notes: input.notes ?? null,
        netTotal,
        taxTotal,
        grossTotal,
        lines: { create: linesData },
      },
      include: { lines: true },
    });
  });
}

export async function deleteDraftOffer(offerId: string) {
  return prisma.$transaction(async (tx) => {
    await lockOffer(tx, offerId);
    const offer = await tx.offer.findUnique({ where: { id: offerId }, select: { status: true } });
    if (!offer) throw new ApiError(404, "Angebot nicht gefunden");
    if (offer.status !== "DRAFT") throw new ApiError(400, "Nur Angebotsentwürfe können gelöscht werden");
    await tx.offer.delete({ where: { id: offerId } });
  });
}

export async function finalizeOffer(offerId: string) {
  return prisma.$transaction(async (tx) => {
    await lockOffer(tx, offerId);
    const offer = await tx.offer.findUnique({
      where: { id: offerId },
      include: { customer: true },
    });
    if (!offer) throw new ApiError(404, "Angebot nicht gefunden");
    if (offer.status !== "DRAFT") throw new ApiError(400, "Nur Entwürfe können finalisiert werden");
    const number = await assignOfferNumberTx(tx, offer.issueDate);
    const customer = offer.customer;
    return tx.offer.update({
      where: { id: offerId },
      data: {
        number,
        status: "OPEN",
        finalizedAt: new Date(),
        customerName: customer.name,
        customerAddress: [
          customer.street,
          `${customer.zip} ${customer.city}`.trim(),
          customer.country,
        ].filter(Boolean).join("\n"),
        customerUid: customer.uid,
      },
      include: { lines: true, customer: true },
    });
  });
}

export async function updateOfferStatus(offerId: string, status: Exclude<OfferStatus, "DRAFT" | "CONVERTED">) {
  return prisma.$transaction(async (tx) => {
    await lockOffer(tx, offerId);
    const offer = await tx.offer.findUnique({ where: { id: offerId }, select: { status: true } });
    if (!offer) throw new ApiError(404, "Angebot nicht gefunden");
    if (offer.status === "DRAFT") throw new ApiError(400, "Der Entwurf muss zuerst finalisiert werden");
    if (offer.status === "CONVERTED") throw new ApiError(400, "Das Angebot wurde bereits in Rechnung gestellt");
    if (status !== "OPEN" && offer.status !== "OPEN") {
      throw new ApiError(400, "Nur offene Angebote können angenommen oder abgelehnt werden");
    }
    return tx.offer.update({
      where: { id: offerId },
      data: {
        status,
        acceptedAt: status === "ACCEPTED" ? new Date() : null,
      },
    });
  });
}

export async function convertOfferToInvoice(offerId: string) {
  return prisma.$transaction(async (tx) => {
    await lockOffer(tx, offerId);
    const offer = await tx.offer.findUnique({
      where: { id: offerId },
      include: { lines: { orderBy: { position: "asc" } }, convertedInvoice: true },
    });
    if (!offer) throw new ApiError(404, "Angebot nicht gefunden");
    if (offer.convertedInvoice) return offer.convertedInvoice;
    if (offer.status !== "ACCEPTED" && offer.status !== "CONVERTED") {
      throw new ApiError(400, "Nur angenommene Angebote können in Rechnungen umgewandelt werden");
    }
    const settings = await tx.companySettings.upsert({
      where: { id: "singleton" },
      update: {},
      create: { id: "singleton" },
    });
    const issueDate = new Date();
    const dueDate = new Date(issueDate);
    dueDate.setDate(dueDate.getDate() + settings.paymentDays);
    const invoice = await tx.invoice.create({
      data: {
        sourceOfferId: offer.id,
        customerId: offer.customerId,
        issueDate,
        dueDate,
        taxTreatment: offer.taxTreatment,
        notes: offer.notes,
        netTotal: offer.netTotal,
        taxTotal: offer.taxTotal,
        grossTotal: offer.grossTotal,
        skontoPercent: settings.skontoPercent,
        skontoDays: settings.skontoDays,
        lines: {
          create: offer.lines.map((line) => ({
            position: line.position,
            description: line.description,
            quantity: line.quantity,
            unit: line.unit,
            unitPrice: line.unitPrice,
            taxRate: line.taxRate,
            lineNet: line.lineNet,
            softwareItemId: line.softwareItemId,
            itemId: line.itemId,
            warehouseId: line.warehouseId,
          })),
        },
      },
      include: { lines: true },
    });
    await tx.offer.update({
      where: { id: offer.id },
      data: { status: "CONVERTED", convertedAt: new Date() },
    });
    return invoice;
  });
}
