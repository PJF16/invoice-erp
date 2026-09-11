import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPagination, handleApiError, requireModule } from "@/lib/api-helpers";
import type { MovementBillingStatus } from "@/lib/generated/prisma/enums";

const statuses = new Set<MovementBillingStatus>(["PENDING", "INVOICED", "GIFTED", "CANCELED"]);
const sources = new Set(["ALL", "WITHOUT_DELIVERY_NOTE", "WITH_DELIVERY_NOTE"]);

export async function GET(req: NextRequest) {
  try {
    await requireModule("STOCK");
    const params = req.nextUrl.searchParams;
    const customerId = params.get("customerId") || undefined;
    const rawStatus = params.get("status") as MovementBillingStatus | null;
    const status = rawStatus && statuses.has(rawStatus) ? rawStatus : "PENDING";
    const rawSource = params.get("source") ?? "ALL";
    const source = sources.has(rawSource) ? rawSource : "ALL";
    const { take, skip } = getPagination(params, { limit: 500, max: 500 });
    const fetchLimit = take + skip;

    const [movements, deliveryLines] = await Promise.all([
      source === "WITH_DELIVERY_NOTE" ? [] : prisma.movement.findMany({
        where: { type: "OUT", customerId: customerId ?? { not: null }, billingStatus: status, deliveryNoteLine: { is: null } },
        orderBy: { createdAt: "desc" }, take: fetchLimit,
        include: { customer: { select: { id: true, name: true, customerNumber: true } }, item: { select: { id: true, name: true, sku: true } }, warehouse: { select: { id: true, name: true } }, invoiceLine: { select: { invoice: { select: { id: true, number: true, status: true } } } } },
      }),
      source === "WITHOUT_DELIVERY_NOTE" ? [] : prisma.deliveryNoteLine.findMany({
        where: { billingStatus: status, deliveryNote: { customerId } },
        orderBy: { deliveryNote: { createdAt: "desc" } }, take: fetchLimit,
        include: { item: { select: { id: true, name: true, sku: true } }, warehouse: { select: { id: true, name: true } }, invoiceLine: { select: { invoice: { select: { id: true, number: true, status: true } } } }, movement: { select: { invoiceLine: { select: { invoice: { select: { id: true, number: true, status: true } } } } } }, deliveryNote: { include: { customer: { select: { id: true, name: true, customerNumber: true } } } } },
      }),
    ]);

    const rows = [
      ...movements.flatMap((movement) => movement.customer ? [{ id: movement.id, sourceType: "MOVEMENT", createdAt: movement.createdAt, quantity: Math.abs(movement.quantity), billingStatus: movement.billingStatus, note: movement.note, customer: movement.customer, item: movement.item, warehouse: movement.warehouse, invoice: movement.invoiceLine?.invoice ?? null, deliveryNote: null }] : []),
      ...deliveryLines.map((line) => ({ id: line.id, sourceType: "DELIVERY_NOTE_LINE", createdAt: line.deliveryNote.createdAt, quantity: line.billingStatus === "CANCELED" ? line.quantity : line.quantity - line.canceledQuantity, billingStatus: line.billingStatus, note: line.deliveryNote.notes, customer: line.deliveryNote.customer, item: line.item, warehouse: line.warehouse, invoice: line.invoiceLine?.invoice ?? line.movement?.invoiceLine?.invoice ?? null, deliveryNote: { id: line.deliveryNote.id, number: line.deliveryNote.number } })),
    ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(skip, skip + take);

    return NextResponse.json(rows);
  } catch (error) {
    return handleApiError(error);
  }
}
