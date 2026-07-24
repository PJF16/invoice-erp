import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireModule, handleApiError } from "@/lib/api-helpers";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireModule("STOCK");
    const { id } = await params;
    const deliveryNote = await prisma.deliveryNote.findUnique({
      where: { id },
      include: {
        customer: true,
        createdBy: { select: { id: true, name: true } },
        lines: { orderBy: { position: "asc" }, include: { movement: { include: { invoiceLine: { include: { invoice: { select: { id: true, number: true } } } } } } } },
      },
    });
    if (!deliveryNote) return NextResponse.json({ error: "Lieferschein nicht gefunden" }, { status: 404 });
    return NextResponse.json(deliveryNote);
  } catch (error) {
    return handleApiError(error);
  }
}
