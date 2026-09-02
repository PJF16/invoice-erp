import { NextResponse, type NextRequest } from "next/server";
import { requireModule, handleApiError } from "@/lib/api-helpers";
import { finalizeInvoice } from "@/lib/invoices";
import { finalizeInvoiceSchema } from "@/lib/validation";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireModule("INVOICES");
    const { id } = await params;
    const raw = await req.json().catch(() => ({}));
    const parsed = finalizeInvoiceSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    const invoice = await finalizeInvoice(id, session.user.id, parsed.data);
    return NextResponse.json(invoice);
  } catch (error) {
    return handleApiError(error);
  }
}
