import { NextResponse } from "next/server";
import { requireModule, handleApiError } from "@/lib/api-helpers";
import { deletePayment } from "@/lib/payments";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; paymentId: string }> },
) {
  try {
    await requireModule("INVOICES");
    const { paymentId } = await params;
    const invoice = await deletePayment(paymentId);
    return NextResponse.json(invoice);
  } catch (error) {
    return handleApiError(error);
  }
}
