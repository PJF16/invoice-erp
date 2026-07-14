import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireModule, handleApiError } from "@/lib/api-helpers";
import { createStornoInvoice } from "@/lib/invoices";
import { settleFully, clearPayments } from "@/lib/payments";

const statusSchema = z.object({ status: z.enum(["PAID", "CANCELED", "OPEN"]) });

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireModule("INVOICES");
    const { id } = await params;
    const parsed = statusSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Ungültiger Status" }, { status: 400 });
    }

    if (parsed.data.status === "CANCELED") {
      const storno = await createStornoInvoice(id, session.user.id);
      return NextResponse.json(storno);
    }

    const existing = await prisma.invoice.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Rechnung nicht gefunden" }, { status: 404 });
    if (existing.status === "DRAFT" || existing.status === "CANCELED") {
      return NextResponse.json({ error: "Statuswechsel nicht möglich" }, { status: 400 });
    }

    // Bezahlt-Status läuft über die Zahlungserfassung: „bezahlt" bucht den offenen
    // Restbetrag als Zahlung, „zurücksetzen" entfernt alle erfassten Zahlungen.
    const invoice =
      parsed.data.status === "PAID"
        ? await settleFully(id, session.user.id)
        : await clearPayments(id);
    return NextResponse.json(invoice);
  } catch (error) {
    return handleApiError(error);
  }
}
