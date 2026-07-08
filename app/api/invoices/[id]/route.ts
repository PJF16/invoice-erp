import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, handleApiError } from "@/lib/api-helpers";
import { invoiceSchema } from "@/lib/validation";
import { computeTotals } from "@/lib/invoices";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    await requireSession();
    const { id } = await params;
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: { lines: { orderBy: { position: "asc" } }, customer: true },
    });
    if (!invoice) return NextResponse.json({ error: "Rechnung nicht gefunden" }, { status: 404 });
    return NextResponse.json(invoice);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    await requireSession();
    const { id } = await params;
    const existing = await prisma.invoice.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Rechnung nicht gefunden" }, { status: 404 });
    if (existing.status !== "DRAFT") {
      return NextResponse.json({ error: "Nur Entwürfe können bearbeitet werden" }, { status: 400 });
    }
    const parsed = invoiceSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    const data = parsed.data;
    const { lines, netTotal, taxTotal, grossTotal } = computeTotals(data.lines, data.taxTreatment);

    const invoice = await prisma.$transaction(async (tx) => {
      await tx.invoiceLine.deleteMany({ where: { invoiceId: id } });
      return tx.invoice.update({
        where: { id },
        data: {
          customerId: data.customerId,
          issueDate: data.issueDate,
          dueDate: data.dueDate,
          servicePeriodStart: data.servicePeriodStart ?? null,
          servicePeriodEnd: data.servicePeriodEnd ?? null,
          taxTreatment: data.taxTreatment,
          notes: data.notes ?? null,
          netTotal,
          taxTotal,
          grossTotal,
          lines: {
            create: lines.map((line, i) => ({
              position: i + 1,
              description: line.description,
              quantity: line.quantity,
              unit: line.unit,
              unitPrice: line.unitPrice,
              taxRate: line.taxRate,
              lineNet: line.lineNet,
              softwareItemId: line.softwareItemId ?? null,
              itemId: line.itemId ?? null,
              warehouseId: line.warehouseId ?? null,
            })),
          },
        },
        include: { lines: true },
      });
    });
    return NextResponse.json(invoice);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    await requireSession();
    const { id } = await params;
    const existing = await prisma.invoice.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Rechnung nicht gefunden" }, { status: 404 });
    if (existing.status !== "DRAFT") {
      return NextResponse.json(
        { error: "Nur Entwürfe können gelöscht werden — finalisierte Rechnungen stornieren" },
        { status: 400 },
      );
    }
    await prisma.invoice.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
