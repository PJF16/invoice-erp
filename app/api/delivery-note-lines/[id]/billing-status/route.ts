import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, handleApiError, requireModule } from "@/lib/api-helpers";
import { movementBillingStatusSchema } from "@/lib/validation";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireModule("STOCK");
    const parsed = movementBillingStatusSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    const { id } = await params;
    const line = await prisma.deliveryNoteLine.findUnique({
      where: { id },
      include: { deliveryNote: true, invoiceLine: true, movement: { include: { invoiceLine: true } } },
    });
    if (!line) throw new ApiError(404, "Kundenübergabe nicht gefunden");
    if (line.deliveryNote.status === "CANCELED" || line.billingStatus === "CANCELED") {
      throw new ApiError(400, "Eine stornierte Übergabe kann nicht geändert werden");
    }
    if ((line.invoiceLine || line.movement?.invoiceLine) && parsed.data.billingStatus !== "INVOICED") {
      throw new ApiError(400, "Die Übergabe ist mit einer Rechnung verknüpft und kann nicht manuell geändert werden");
    }
    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.deliveryNoteLine.update({ where: { id }, data: { billingStatus: parsed.data.billingStatus } });
      if (line.movementId) await tx.movement.update({ where: { id: line.movementId }, data: { billingStatus: parsed.data.billingStatus } });
      return result;
    });
    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError(error);
  }
}
