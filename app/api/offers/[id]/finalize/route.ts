import { NextResponse, type NextRequest } from "next/server";
import { requireModule, handleApiError } from "@/lib/api-helpers";
import { finalizeOffer } from "@/lib/offers";
import { finalizeOfferSchema } from "@/lib/validation";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireModule("INVOICES");
    const { id } = await params;
    const raw = await req.json().catch(() => ({}));
    const parsed = finalizeOfferSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    return NextResponse.json(await finalizeOffer(id, parsed.data));
  } catch (error) {
    return handleApiError(error);
  }
}
