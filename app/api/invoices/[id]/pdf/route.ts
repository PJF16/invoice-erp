import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, handleApiError } from "@/lib/api-helpers";
import { getSettings } from "@/lib/settings";
import { renderInvoicePdf } from "@/lib/invoice-pdf";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireSession();
    const { id } = await params;
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: { lines: { orderBy: { position: "asc" } }, customer: true },
    });
    if (!invoice) return NextResponse.json({ error: "Rechnung nicht gefunden" }, { status: 404 });

    // Für Entwürfe eine Vorschau mit aktuellen Kundendaten rendern
    const data =
      invoice.status === "DRAFT"
        ? {
            ...invoice,
            customerName: invoice.customer.name,
            customerAddress: [
              invoice.customer.street,
              `${invoice.customer.zip} ${invoice.customer.city}`.trim(),
              invoice.customer.country,
            ]
              .filter(Boolean)
              .join("\n"),
            customerUid: invoice.customer.uid,
          }
        : invoice;

    const settings = await getSettings();
    const pdf = await renderInvoicePdf(data, settings);
    const filename = `Rechnung_${(invoice.number ?? "Entwurf").replace(/[^\w-]/g, "_")}.pdf`;

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
