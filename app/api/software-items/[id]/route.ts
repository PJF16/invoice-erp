import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireModule, handleApiError } from "@/lib/api-helpers";
import { softwareItemSchema } from "@/lib/validation";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    await requireModule("INVOICES");
    const { id } = await params;
    const parsed = softwareItemSchema.partial().safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    const item = await prisma.softwareItem.update({ where: { id }, data: parsed.data });
    return NextResponse.json(item);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    await requireModule("INVOICES");
    const { id } = await params;
    const usage = await prisma.recurringInvoiceLine.count({ where: { softwareItemId: id } });
    if (usage > 0) {
      return NextResponse.json(
        { error: "Artikel wird in wiederkehrenden Rechnungen verwendet — stattdessen deaktivieren" },
        { status: 400 },
      );
    }
    await prisma.softwareItem.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
