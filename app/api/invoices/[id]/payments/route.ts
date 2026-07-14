import { NextResponse, type NextRequest } from "next/server";
import { requireModule, handleApiError } from "@/lib/api-helpers";
import { paymentSchema } from "@/lib/validation";
import { recordPayment } from "@/lib/payments";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireModule("INVOICES");
    const { id } = await params;
    const parsed = paymentSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    const invoice = await recordPayment(id, parsed.data, session.user.id);
    return NextResponse.json(invoice, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
