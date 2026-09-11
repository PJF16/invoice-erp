import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleApiError, requireModule } from "@/lib/api-helpers";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireModule("STOCK");
    const { id } = await params;
    const movement = await prisma.movement.findUnique({
      where: { id },
      include: {
        item: true,
        warehouse: true,
        user: { select: { id: true, name: true } },
        customer: true,
        invoiceLine: { include: { invoice: true } },
        deliveryNoteLine: { include: { deliveryNote: true } },
      },
    });
    if (!movement) return NextResponse.json({ error: "Lagerbewegung nicht gefunden" }, { status: 404 });
    return NextResponse.json(movement);
  } catch (error) {
    return handleApiError(error);
  }
}
