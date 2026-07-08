import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, handleApiError } from "@/lib/api-helpers";
import { recurringInvoiceSchema } from "@/lib/validation";

export async function GET() {
  try {
    await requireSession();
    const templates = await prisma.recurringInvoice.findMany({
      orderBy: { name: "asc" },
      include: {
        customer: { select: { id: true, name: true } },
        lines: { orderBy: { position: "asc" }, include: { softwareItem: true } },
      },
    });
    return NextResponse.json(templates);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireSession();
    const parsed = recurringInvoiceSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    const { lines, ...data } = parsed.data;
    const template = await prisma.recurringInvoice.create({
      data: {
        ...data,
        lines: {
          create: lines.map((line, i) => ({ ...line, position: i + 1 })),
        },
      },
      include: { lines: true },
    });
    return NextResponse.json(template, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
