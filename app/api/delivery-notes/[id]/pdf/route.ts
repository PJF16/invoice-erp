import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireModule, handleApiError } from "@/lib/api-helpers";
import { getSettings } from "@/lib/settings";
import { renderDeliveryNotePdf } from "@/lib/delivery-note-pdf";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireModule("STOCK");
    const { id } = await params;
    const deliveryNote = await prisma.deliveryNote.findUnique({
      where: { id },
      include: { lines: { orderBy: { position: "asc" } }, customer: true, createdBy: true },
    });
    if (!deliveryNote) return NextResponse.json({ error: "Lieferschein nicht gefunden" }, { status: 404 });
    const pdf = await renderDeliveryNotePdf(deliveryNote, await getSettings());
    const filename = `Lieferschein_${deliveryNote.number.replace(/[^\w-]/g, "_")}.pdf`;
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
