import { NextResponse, type NextRequest } from "next/server";
import { requireSession, handleApiError } from "@/lib/api-helpers";
import { sendInvoiceEmail } from "@/lib/mailer";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireSession();
    const { id } = await params;
    const invoice = await sendInvoiceEmail(id);
    return NextResponse.json(invoice);
  } catch (error) {
    return handleApiError(error);
  }
}
