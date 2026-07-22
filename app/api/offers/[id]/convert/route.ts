import { NextResponse, type NextRequest } from "next/server";
import { requireModule, handleApiError } from "@/lib/api-helpers";
import { convertOfferToInvoice } from "@/lib/offers";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireModule("INVOICES");
    const { id } = await params;
    return NextResponse.json(await convertOfferToInvoice(id));
  } catch (error) {
    return handleApiError(error);
  }
}
