import { NextResponse, type NextRequest } from "next/server";
import { handleApiError } from "@/lib/api-helpers";
import { renderInvoicePdf } from "@/lib/invoice-pdf";
import { requirePortalSession } from "@/lib/portal-auth";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const [{ email }, { id }] = await Promise.all([requirePortalSession(), params]);
    const invoice = await prisma.invoice.findFirst({
      where: {
        id,
        customer: { email: { equals: email, mode: "insensitive" } },
        number: { not: null },
        status: { not: "DRAFT" },
      },
      include: { lines: { orderBy: { position: "asc" } }, customer: true },
    });
    if (!invoice) return NextResponse.json({ error: "Rechnung nicht gefunden" }, { status: 404 });

    const settings = await getSettings();
    const pdf = await renderInvoicePdf(invoice, settings);
    const filename = `Rechnung_${invoice.number!.replace(/[^\w-]/g, "_")}.pdf`;
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
