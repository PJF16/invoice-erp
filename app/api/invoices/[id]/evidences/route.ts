import { NextResponse, type NextRequest } from "next/server";
import { ApiError, handleApiError, requireModule } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const EVIDENCE_TYPES = new Set(["TRANSPORT_PROOF", "EXPORT_PROOF", "TAX_DOCUMENT", "OTHER"]);

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    await requireModule("INVOICES");
    const { id } = await params;
    const evidences = await prisma.invoiceEvidence.findMany({
      where: { invoiceId: id, deletedAt: null },
      orderBy: { createdAt: "desc" },
      select: { id: true, type: true, fileName: true, mimeType: true, size: true, note: true, createdAt: true },
    });
    return NextResponse.json(evidences);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const session = await requireModule("INVOICES");
    const { id } = await params;
    const invoice = await prisma.invoice.findUnique({ where: { id }, select: { id: true } });
    if (!invoice) throw new ApiError(404, "Rechnung nicht gefunden");

    const form = await req.formData();
    const file = form.get("file");
    const type = String(form.get("type") ?? "OTHER");
    const note = String(form.get("note") ?? "").trim() || null;
    if (!(file instanceof File)) throw new ApiError(400, "Datei ist erforderlich");
    if (!file.size) throw new ApiError(400, "Die Datei ist leer");
    if (file.size > MAX_FILE_SIZE) throw new ApiError(400, "Die Datei darf maximal 10 MB groß sein");
    if (!EVIDENCE_TYPES.has(type)) throw new ApiError(400, "Ungültige Nachweisart");
    if (note && note.length > 500) throw new ApiError(400, "Notiz darf maximal 500 Zeichen lang sein");

    const evidence = await prisma.invoiceEvidence.create({
      data: {
        invoiceId: id,
        type: type as "TRANSPORT_PROOF" | "EXPORT_PROOF" | "TAX_DOCUMENT" | "OTHER",
        fileName: file.name.slice(0, 255) || "nachweis",
        mimeType: file.type.slice(0, 150) || "application/octet-stream",
        size: file.size,
        data: new Uint8Array(await file.arrayBuffer()),
        note,
        uploadedById: session.user.id,
      },
      select: { id: true, type: true, fileName: true, mimeType: true, size: true, note: true, createdAt: true },
    });
    return NextResponse.json(evidence, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

