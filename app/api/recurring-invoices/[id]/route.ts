import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, handleApiError } from "@/lib/api-helpers";
import { recurringInvoiceSchema } from "@/lib/validation";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    await requireSession();
    const { id } = await params;
    const parsed = recurringInvoiceSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    const { lines, ...data } = parsed.data;
    const template = await prisma.$transaction(async (tx) => {
      await tx.recurringInvoiceLine.deleteMany({ where: { recurringInvoiceId: id } });
      return tx.recurringInvoice.update({
        where: { id },
        data: {
          ...data,
          lines: { create: lines.map((line, i) => ({ ...line, position: i + 1 })) },
        },
        include: { lines: true },
      });
    });
    return NextResponse.json(template);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    await requireSession();
    const { id } = await params;
    // Bereits erzeugte Rechnungen behalten (Verknüpfung wird gelöst)
    await prisma.$transaction([
      prisma.invoice.updateMany({ where: { recurringInvoiceId: id }, data: { recurringInvoiceId: null } }),
      prisma.recurringInvoice.delete({ where: { id } }),
    ]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
