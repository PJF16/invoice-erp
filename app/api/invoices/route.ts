import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireModule, handleApiError, getPagination } from "@/lib/api-helpers";
import { invoiceSchema } from "@/lib/validation";
import { createDraftInvoice } from "@/lib/invoices";
import type { InvoiceStatus } from "@/lib/generated/prisma/enums";

const statuses = new Set<InvoiceStatus>(["DRAFT", "OPEN", "SENT", "PAID", "CANCELED"]);

export async function GET(req: NextRequest) {
  try {
    await requireModule("INVOICES");
    const rawStatus = req.nextUrl.searchParams.get("status") as InvoiceStatus | null;
    const status = rawStatus && statuses.has(rawStatus) ? rawStatus : undefined;
    const customerId = req.nextUrl.searchParams.get("customerId") || undefined;
    const q = req.nextUrl.searchParams.get("q")?.trim();
    const invoices = await prisma.invoice.findMany({
      where: {
        status,
        customerId,
        ...(q ? { OR: [{ number: { contains: q, mode: "insensitive" } }, { customerName: { contains: q, mode: "insensitive" } }] } : {}),
      },
      orderBy: { createdAt: "desc" },
      ...getPagination(req.nextUrl.searchParams, { limit: 200, max: 500 }),
      include: { customer: { select: { id: true, name: true } } },
    });
    return NextResponse.json(invoices);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireModule("INVOICES");
    const parsed = invoiceSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    const invoice = await createDraftInvoice(parsed.data);
    return NextResponse.json(invoice, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
