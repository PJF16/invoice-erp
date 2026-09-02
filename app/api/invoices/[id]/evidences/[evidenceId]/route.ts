import { NextResponse, type NextRequest } from "next/server";
import { ApiError, handleApiError, requireModule } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string; evidenceId: string }> };

function safeDownloadName(value: string) {
  return value.replace(/[\r\n"\\/]/g, "_").slice(0, 255) || "nachweis";
}

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    await requireModule("INVOICES");
    const { id, evidenceId } = await params;
    const evidence = await prisma.invoiceEvidence.findFirst({
      where: { id: evidenceId, invoiceId: id, deletedAt: null },
    });
    if (!evidence) throw new ApiError(404, "Nachweis nicht gefunden");
    return new NextResponse(new Uint8Array(evidence.data), {
      headers: {
        "Content-Type": evidence.mimeType,
        "Content-Length": String(evidence.size),
        "Content-Disposition": `attachment; filename="${safeDownloadName(evidence.fileName)}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    await requireModule("INVOICES");
    const { id, evidenceId } = await params;
    const result = await prisma.invoiceEvidence.updateMany({
      where: { id: evidenceId, invoiceId: id, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    if (!result.count) throw new ApiError(404, "Nachweis nicht gefunden");
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}

