import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api-helpers";
import { bookMovementTx } from "@/lib/movements";
import { assignDeliveryNoteNumberTx } from "@/lib/document-numbers";
import type { DeliveryMethod } from "@/lib/generated/prisma/enums";

export type DeliveryNoteInput = {
  customerId: string;
  issueDate?: Date;
  deliveryMethod: DeliveryMethod;
  distributor?: string | null;
  distributorReference?: string | null;
  trackingNumber?: string | null;
  notes?: string | null;
  lines: { itemId: string; warehouseId?: string | null; quantity: number }[];
};

export async function createDeliveryNote(input: DeliveryNoteInput, userId: string) {
  const uniqueKeys = new Set(input.lines.map((line) => `${line.itemId}:${line.warehouseId ?? "direct"}`));
  if (uniqueKeys.size !== input.lines.length) {
    throw new ApiError(400, "Derselbe Artikel und dasselbe Lager dürfen nur einmal vorkommen");
  }
  const issueDate = input.issueDate ?? new Date();
  return prisma.$transaction(async (tx) => {
    const customer = await tx.customer.findUnique({ where: { id: input.customerId } });
    if (!customer) throw new ApiError(404, "Kunde nicht gefunden");
    const number = await assignDeliveryNoteNumberTx(tx, issueDate);
    const deliveryNote = await tx.deliveryNote.create({
      data: {
        number,
        customerId: customer.id,
        customerName: customer.name,
        customerAddress: [
          customer.street,
          `${customer.zip} ${customer.city}`.trim(),
          customer.country,
        ].filter(Boolean).join("\n"),
        customerUid: customer.uid,
        issueDate,
        deliveryMethod: input.deliveryMethod,
        distributor: input.deliveryMethod === "DISTRIBUTOR_DIRECT" ? input.distributor : null,
        distributorReference: input.deliveryMethod === "DISTRIBUTOR_DIRECT" ? input.distributorReference : null,
        trackingNumber: input.deliveryMethod === "DISTRIBUTOR_DIRECT" ? input.trackingNumber : null,
        notes: input.notes ?? null,
        createdById: userId,
      },
    });

    const positionedLines = input.lines.map((line, index) => ({ ...line, position: index + 1 }));
    const bookingOrder = [...positionedLines].sort((a, b) => `${a.warehouseId ?? ""}:${a.itemId}`.localeCompare(`${b.warehouseId ?? ""}:${b.itemId}`));
    for (const line of bookingOrder) {
      const item = await tx.item.findUnique({ where: { id: line.itemId } });
      if (!item) throw new ApiError(404, "Artikel nicht gefunden");
      const booked = input.deliveryMethod === "STOCK"
        ? await bookMovementTx(tx, {
            itemId: line.itemId,
            warehouseId: line.warehouseId!,
            type: "OUT",
            quantity: line.quantity,
            userId,
            customerId: customer.id,
            billingStatus: "PENDING",
            note: `Lieferschein ${number}`,
          })
        : null;
      await tx.deliveryNoteLine.create({
        data: {
          deliveryNoteId: deliveryNote.id,
          position: line.position,
          itemId: item.id,
          itemName: item.name,
          itemSku: item.sku,
          warehouseId: booked?.movement.warehouseId ?? null,
          warehouseName: booked?.movement.warehouse.name ?? null,
          quantity: line.quantity,
          billingStatus: "PENDING",
          movementId: booked?.movement.id ?? null,
        },
      });
    }
    return tx.deliveryNote.findUniqueOrThrow({
      where: { id: deliveryNote.id },
      include: { lines: { orderBy: { position: "asc" } }, customer: true },
    });
  }, { timeout: 15_000 });
}

export async function cancelDeliveryNote(deliveryNoteId: string, userId: string, reason: string) {
  return prisma.$transaction(async (tx) => {
    const note = await tx.deliveryNote.findUnique({
      where: { id: deliveryNoteId },
      include: { lines: { include: { invoiceLine: true, movement: { include: { invoiceLine: true } } } } },
    });
    if (!note) throw new ApiError(404, "Lieferschein nicht gefunden");
    if (note.status === "CANCELED") throw new ApiError(400, "Der Lieferschein ist bereits storniert");
    if (note.lines.some((line) => line.invoiceLine || line.movement?.invoiceLine || line.billingStatus === "INVOICED")) {
      throw new ApiError(400, "Verrechnete Übergaben können erst nach dem Löschen des Rechnungsentwurfs oder dem Storno der Rechnung storniert werden");
    }

    const now = new Date();
    for (const line of note.lines) {
      if (line.movement && !line.movement.canceledAt) {
        await bookMovementTx(tx, {
          itemId: line.itemId,
          warehouseId: line.movement.warehouseId,
          type: "IN",
          quantity: line.quantity,
          userId,
          note: `Storno Lieferschein ${note.number}: ${reason}`,
        });
        await tx.movement.update({
          where: { id: line.movement.id },
          data: { billingStatus: "CANCELED", canceledAt: now, canceledById: userId, canceledReason: reason },
        });
      }
    }
    await tx.deliveryNoteLine.updateMany({
      where: { deliveryNoteId },
      data: { billingStatus: "CANCELED" },
    });
    return tx.deliveryNote.update({
      where: { id: deliveryNoteId },
      data: { status: "CANCELED", canceledAt: now, canceledById: userId, canceledReason: reason },
    });
  }, { timeout: 15_000 });
}
