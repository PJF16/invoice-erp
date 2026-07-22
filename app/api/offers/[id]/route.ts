import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireModule, handleApiError } from "@/lib/api-helpers";
import { offerSchema } from "@/lib/validation";
import { deleteDraftOffer, updateDraftOffer } from "@/lib/offers";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    await requireModule("INVOICES");
    const { id } = await params;
    const offer = await prisma.offer.findUnique({
      where: { id },
      include: { lines: { orderBy: { position: "asc" } }, customer: true, convertedInvoice: true },
    });
    if (!offer) return NextResponse.json({ error: "Angebot nicht gefunden" }, { status: 404 });
    return NextResponse.json(offer);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    await requireModule("INVOICES");
    const { id } = await params;
    const parsed = offerSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    return NextResponse.json(await updateDraftOffer(id, parsed.data));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    await requireModule("INVOICES");
    const { id } = await params;
    await deleteDraftOffer(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
