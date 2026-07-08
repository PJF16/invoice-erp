import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession, handleApiError } from "@/lib/api-helpers";
import { cancelInvoice } from "@/lib/invoices";

const statusSchema = z.object({ status: z.enum(["PAID", "CANCELED", "OPEN"]) });

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    const { id } = await params;
    const parsed = statusSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Ungültiger Status" }, { status: 400 });
    }

    if (parsed.data.status === "CANCELED") {
      const invoice = await cancelInvoice(id, session.user.id);
      return NextResponse.json(invoice);
    }

    const existing = await prisma.invoice.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Rechnung nicht gefunden" }, { status: 404 });
    if (existing.status === "DRAFT" || existing.status === "CANCELED") {
      return NextResponse.json({ error: "Statuswechsel nicht möglich" }, { status: 400 });
    }

    const invoice = await prisma.invoice.update({
      where: { id },
      data:
        parsed.data.status === "PAID"
          ? { status: "PAID", paidAt: new Date() }
          : { status: existing.sentAt ? "SENT" : "OPEN", paidAt: null },
    });
    return NextResponse.json(invoice);
  } catch (error) {
    return handleApiError(error);
  }
}
