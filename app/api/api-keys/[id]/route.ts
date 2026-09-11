import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, handleApiError, requireSession } from "@/lib/api-helpers";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    const { id } = await params;
    const deleted = await prisma.apiKey.deleteMany({ where: { id, userId: session.user.id } });
    if (!deleted.count) throw new ApiError(404, "API-Schlüssel nicht gefunden");
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
