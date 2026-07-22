import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireModule, handleApiError } from "@/lib/api-helpers";
import { movementSchema } from "@/lib/validation";
import { bookMovement } from "@/lib/movements";
import type { MovementType } from "@/lib/generated/prisma/enums";

export async function GET(req: NextRequest) {
  try {
    await requireModule("STOCK");
    const sp = req.nextUrl.searchParams;
    const warehouseId = sp.get("warehouseId") ?? undefined;
    const itemId = sp.get("itemId") ?? undefined;
    const type = sp.get("type") as MovementType | null;
    const limit = Math.min(Number(sp.get("limit") ?? 100), 500);

    const movements = await prisma.movement.findMany({
      where: {
        warehouseId,
        itemId,
        type: type ?? undefined,
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        item: { select: { id: true, name: true, sku: true } },
        warehouse: { select: { id: true, name: true } },
        user: { select: { id: true, name: true } },
        customer: { select: { id: true, name: true, customerNumber: true } },
      },
    });
    return NextResponse.json(movements);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireModule("STOCK");
    const parsed = movementSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    const result = await bookMovement({ ...parsed.data, userId: session.user.id });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
