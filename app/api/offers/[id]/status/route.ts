import { NextResponse, type NextRequest } from "next/server";
import { requireModule, handleApiError } from "@/lib/api-helpers";
import { offerStatusSchema } from "@/lib/validation";
import { updateOfferStatus } from "@/lib/offers";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireModule("INVOICES");
    const { id } = await params;
    const parsed = offerStatusSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    return NextResponse.json(await updateOfferStatus(id, parsed.data.status));
  } catch (error) {
    return handleApiError(error);
  }
}
