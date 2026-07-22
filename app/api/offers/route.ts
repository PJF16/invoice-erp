import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireModule, handleApiError } from "@/lib/api-helpers";
import { offerSchema } from "@/lib/validation";
import { createDraftOffer } from "@/lib/offers";
import type { OfferStatus } from "@/lib/generated/prisma/enums";

const statuses = new Set<OfferStatus>(["DRAFT", "OPEN", "ACCEPTED", "REJECTED", "CONVERTED"]);

export async function GET(req: NextRequest) {
  try {
    await requireModule("INVOICES");
    const rawStatus = req.nextUrl.searchParams.get("status") as OfferStatus | null;
    const status = rawStatus && statuses.has(rawStatus) ? rawStatus : undefined;
    const offers = await prisma.offer.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { customer: { select: { id: true, name: true, customerNumber: true } } },
    });
    return NextResponse.json(offers);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireModule("INVOICES");
    const parsed = offerSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    const offer = await createDraftOffer(parsed.data);
    return NextResponse.json(offer, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
