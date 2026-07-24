import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api-helpers";
import { bookMovementTx } from "@/lib/movements";
import { assignDeliveryNoteNumberTx } from "@/lib/document-numbers";

export type DeliveryNoteInput = {
  customerId: string;
  issueDate?: Date;
  notes?: string | null;
  lines: { itemId: string; warehouseId: string; quantity: number }[];
};

export async function createDeliveryNote(input: DeliveryNoteInput, userId: string) {
  const uniqueKeys = new Set(input.lines.map((line) => `${line.itemId}:${line.warehouseId}`));
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
        notes: input.notes ?? null,
        createdById: userId,
      },
    });

    const positionedLines = input.lines.map((line, index) => ({ ...line, position: index + 1 }));
    const bookingOrder = [...positionedLines].sort((a, b) =>
      `${a.warehouseId}:${a.itemId}`.localeCompare(`${b.warehouseId}:${b.itemId}`),
    );
    for (const line of bookingOrder) {
      const { movement } = await bookMovementTx(tx, {
        itemId: line.itemId,
        warehouseId: line.warehouseId,
        type: "OUT",
        quantity: line.quantity,
        userId,
        customerId: customer.id,
        billingStatus: "PENDING",
        note: `Lieferschein ${number}`,
      });
      await tx.deliveryNoteLine.create({
        data: {
          deliveryNoteId: deliveryNote.id,
          position: line.position,
          itemId: movement.itemId,
          itemName: movement.item.name,
          itemSku: movement.item.sku,
          warehouseId: movement.warehouseId,
          warehouseName: movement.warehouse.name,
          quantity: Math.abs(movement.quantity),
          movementId: movement.id,
        },
      });
    }
    return tx.deliveryNote.findUniqueOrThrow({
      where: { id: deliveryNote.id },
      include: { lines: { orderBy: { position: "asc" } }, customer: true },
    });
  }, { timeout: 15_000 });
}
