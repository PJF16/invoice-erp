import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, handleApiError } from "@/lib/api-helpers";
import { warehouseSchema } from "@/lib/validation";

export async function GET() {
  try {
    await requireSession();
    const warehouses = await prisma.warehouse.findMany({ orderBy: { name: "asc" } });
    return NextResponse.json(warehouses);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireSession();
    const parsed = warehouseSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    const warehouse = await prisma.warehouse.create({ data: parsed.data });
    return NextResponse.json(warehouse, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
