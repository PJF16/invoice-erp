import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api-helpers";
import type { MovementType } from "@/lib/generated/prisma/enums";

type BookMovementInput = {
  itemId: string;
  warehouseId: string;
  type: MovementType;
  quantity: number;
  userId: string;
  supplier?: string | null;
  note?: string | null;
};

/**
 * Bucht eine Lagerbewegung und aktualisiert den Bestand in einer Transaktion.
 * IN erhöht, OUT verringert (nie unter 0), ADJUST setzt den Bestand absolut.
 */
export async function bookMovement(input: BookMovementInput) {
  const { itemId, warehouseId, type, quantity, userId, supplier, note } = input;

  if (type !== "ADJUST" && quantity <= 0) {
    throw new ApiError(400, "Menge muss größer als 0 sein");
  }

  return prisma.$transaction(async (tx) => {
    const item = await tx.item.findUnique({ where: { id: itemId } });
    if (!item) throw new ApiError(404, "Artikel nicht gefunden");
    const warehouse = await tx.warehouse.findUnique({ where: { id: warehouseId } });
    if (!warehouse) throw new ApiError(404, "Lager nicht gefunden");

    const stock = await tx.stock.upsert({
      where: { itemId_warehouseId: { itemId, warehouseId } },
      update: {},
      create: { itemId, warehouseId, quantity: 0 },
    });

    let newQuantity: number;
    let movementQuantity = quantity;

    switch (type) {
      case "IN":
        newQuantity = stock.quantity + quantity;
        break;
      case "OUT":
        newQuantity = stock.quantity - quantity;
        if (newQuantity < 0) {
          throw new ApiError(
            400,
            `Nicht genug Bestand: ${stock.quantity} Stück in „${warehouse.name}" verfügbar`,
          );
        }
        break;
      case "ADJUST":
        newQuantity = quantity;
        movementQuantity = quantity - stock.quantity;
        break;
    }

    await tx.stock.update({
      where: { id: stock.id },
      data: { quantity: newQuantity },
    });

    const movement = await tx.movement.create({
      data: { itemId, warehouseId, type, quantity: movementQuantity, userId, supplier, note },
      include: { item: true, warehouse: true },
    });

    return { movement, newQuantity };
  });
}
