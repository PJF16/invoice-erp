import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireModule, handleApiError } from "@/lib/api-helpers";
import { customerSchema } from "@/lib/validation";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    await requireModule("INVOICES");
    const { id } = await params;
    const parsed = customerSchema.partial().safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    const customer = await prisma.customer.update({ where: { id }, data: parsed.data });
    return NextResponse.json(customer);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    await requireModule("INVOICES");
    const { id } = await params;
    const invoiceCount = await prisma.invoice.count({ where: { customerId: id } });
    if (invoiceCount > 0) {
      return NextResponse.json(
        { error: "Kunde hat Rechnungen und kann nicht gelöscht werden" },
        { status: 400 },
      );
    }
    await prisma.customer.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
