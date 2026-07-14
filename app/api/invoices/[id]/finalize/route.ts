import { NextResponse, type NextRequest } from "next/server";
import { requireModule, handleApiError } from "@/lib/api-helpers";
import { finalizeInvoice } from "@/lib/invoices";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireModule("INVOICES");
    const { id } = await params;
    const invoice = await finalizeInvoice(id, session.user.id);
    return NextResponse.json(invoice);
  } catch (error) {
    return handleApiError(error);
  }
}
