import { NextResponse, type NextRequest } from "next/server";
import { requireModule, handleApiError } from "@/lib/api-helpers";
import { generateInvoiceFromTemplate } from "@/lib/recurring";

// „Jetzt ausführen": erzeugt sofort eine Rechnung aus der Vorlage.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireModule("INVOICES");
    const { id } = await params;
    const result = await generateInvoiceFromTemplate(id, session.user.id);
    return NextResponse.json({
      invoiceId: result.invoice.id,
      number: result.invoice.number,
      emailSent: result.emailSent,
      emailError: result.emailError,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
