import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireModule, handleApiError } from "@/lib/api-helpers";
import { deliveryNoteSchema } from "@/lib/validation";
import { createDeliveryNote } from "@/lib/delivery-notes";

export async function GET(req: NextRequest) {
  try {
    await requireModule("STOCK");
    const customerId = req.nextUrl.searchParams.get("customerId") || undefined;
    const deliveryNotes = await prisma.deliveryNote.findMany({
      where: { customerId },
      orderBy: { createdAt: "desc" },
      take: 300,
      include: { customer: { select: { id: true, name: true, customerNumber: true } }, _count: { select: { lines: true } } },
    });
    return NextResponse.json(deliveryNotes);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireModule("STOCK");
    const parsed = deliveryNoteSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    const deliveryNote = await createDeliveryNote(parsed.data, session.user.id);
    return NextResponse.json(deliveryNote, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
