import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireModule, handleApiError } from "@/lib/api-helpers";
import { invoiceSchema } from "@/lib/validation";
import { createDraftInvoice } from "@/lib/invoices";
import type { InvoiceStatus } from "@/lib/generated/prisma/enums";

export async function GET(req: NextRequest) {
  try {
    await requireModule("INVOICES");
    const status = req.nextUrl.searchParams.get("status") as InvoiceStatus | null;
    const invoices = await prisma.invoice.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: "desc" },
      take: 200,
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
