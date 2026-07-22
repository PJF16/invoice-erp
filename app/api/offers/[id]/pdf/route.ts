import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireModule, handleApiError } from "@/lib/api-helpers";
import { getSettings } from "@/lib/settings";
import { renderOfferPdf } from "@/lib/offer-pdf";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireModule("INVOICES");
    const { id } = await params;
    const offer = await prisma.offer.findUnique({
      where: { id },
      include: { lines: { orderBy: { position: "asc" } }, customer: true },
    });
    if (!offer) return NextResponse.json({ error: "Angebot nicht gefunden" }, { status: 404 });
    const data = offer.status === "DRAFT" ? {
      ...offer,
      customerName: offer.customer.name,
      customerAddress: [
        offer.customer.street,
        `${offer.customer.zip} ${offer.customer.city}`.trim(),
        offer.customer.country,
      ].filter(Boolean).join("\n"),
      customerUid: offer.customer.uid,
    } : offer;
    const pdf = await renderOfferPdf(data, await getSettings());
    const filename = `Angebot_${(offer.number ?? "Entwurf").replace(/[^\w-]/g, "_")}.pdf`;
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
