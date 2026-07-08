import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, handleApiError } from "@/lib/api-helpers";

// Für den Scanner-Workflow der iOS-App: Artikel per Barcode nachschlagen.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  try {
    await requireSession();
    const { code } = await params;
    const item = await prisma.item.findUnique({
      where: { barcode: code },
      include: { stocks: { include: { warehouse: true } } },
    });
    if (!item) return NextResponse.json({ error: "Kein Artikel mit diesem Barcode" }, { status: 404 });
    return NextResponse.json(item);
  } catch (error) {
    return handleApiError(error);
  }
}
