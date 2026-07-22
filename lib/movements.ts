import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api-helpers";
import type { MovementBillingStatus, MovementType } from "@/lib/generated/prisma/enums";
import type { Prisma } from "@/lib/generated/prisma/client";

export type Tx = Prisma.TransactionClient;

type BookMovementInput = {
  itemId: string;
  warehouseId: string;
  type: MovementType;
  quantity: number;
  userId: string;
  customerId?: string | null;
  billingStatus?: MovementBillingStatus | null;
  supplier?: string | null;
  note?: string | null;
};

/**
 * Bucht eine Lagerbewegung und aktualisiert den Bestand in einer Transaktion.
 * IN erhöht, OUT verringert (nie unter 0), ADJUST setzt den Bestand absolut.
 */
export async function bookMovement(input: BookMovementInput) {
  return prisma.$transaction((tx) => bookMovementTx(tx, input));
}

/** Wie bookMovement, aber innerhalb einer bestehenden Transaktion (z.B. Rechnungs-Finalisierung). */
export async function bookMovementTx(tx: Tx, input: BookMovementInput) {
  const { itemId, warehouseId, type, quantity, userId, customerId, billingStatus, supplier, note } =
    input;

  if (type !== "ADJUST" && quantity <= 0) {
    throw new ApiError(400, "Menge muss größer als 0 sein");
  }

  {
    const item = await tx.item.findUnique({ where: { id: itemId } });
    if (!item) throw new ApiError(404, "Artikel nicht gefunden");
    const warehouse = await tx.warehouse.findUnique({ where: { id: warehouseId } });
    if (!warehouse) throw new ApiError(404, "Lager nicht gefunden");
    if (customerId) {
      if (type !== "OUT") {
        throw new ApiError(400, "Ein Kunde kann nur bei einem Lagerausgang angegeben werden");
      }
      const customer = await tx.customer.findUnique({ where: { id: customerId } });
      if (!customer) throw new ApiError(404, "Kunde nicht gefunden");
    }

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
      data: {
        itemId,
        warehouseId,
        type,
        quantity: movementQuantity,
        userId,
        customerId: type === "OUT" ? customerId : null,
        billingStatus: type === "OUT" && customerId ? (billingStatus ?? "PENDING") : null,
        supplier,
        note,
      },
      include: { item: true, warehouse: true, customer: true },
    });

    return { movement, newQuantity };
  }
}
