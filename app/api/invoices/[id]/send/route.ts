import { NextResponse, type NextRequest } from "next/server";
import { requireModule, handleApiError } from "@/lib/api-helpers";
import { sendInvoiceEmail } from "@/lib/mailer";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireModule("INVOICES");
    const { id } = await params;
    const invoice = await sendInvoiceEmail(id);
    return NextResponse.json(invoice);
  } catch (error) {
    return handleApiError(error);
  }
}
