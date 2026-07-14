import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireModule, handleApiError } from "@/lib/api-helpers";
import { warehouseSchema } from "@/lib/validation";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    await requireModule("STOCK");
    const { id } = await params;
    const parsed = warehouseSchema.partial().safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    const warehouse = await prisma.warehouse.update({ where: { id }, data: parsed.data });
    return NextResponse.json(warehouse);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    await requireModule("STOCK");
    const { id } = await params;
    await prisma.warehouse.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
