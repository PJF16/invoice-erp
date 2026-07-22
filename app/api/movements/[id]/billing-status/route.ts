import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, handleApiError, requireModule } from "@/lib/api-helpers";
import { movementBillingStatusSchema } from "@/lib/validation";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    await requireModule("STOCK");
    const { id } = await params;
    const parsed = movementBillingStatusSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    const movement = await prisma.movement.findUnique({
      where: { id },
      include: { invoiceLine: { select: { invoiceId: true } } },
    });
    if (!movement) throw new ApiError(404, "Lagerbewegung nicht gefunden");
    if (movement.type !== "OUT" || !movement.customerId || !movement.billingStatus) {
      throw new ApiError(400, "Diese Lagerbewegung ist keine Kundenübergabe");
    }
    if (movement.invoiceLine && parsed.data.billingStatus !== "INVOICED") {
      throw new ApiError(400, "Die Übergabe ist mit einer Rechnung verknüpft und kann nicht manuell geändert werden");
    }
    const updated = await prisma.movement.update({
      where: { id },
      data: { billingStatus: parsed.data.billingStatus },
    });
    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError(error);
  }
}
