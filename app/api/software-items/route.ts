import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireModule, handleApiError } from "@/lib/api-helpers";
import { softwareItemSchema } from "@/lib/validation";

export async function GET() {
  try {
    await requireModule("INVOICES");
    const items = await prisma.softwareItem.findMany({ orderBy: { name: "asc" } });
    return NextResponse.json(items);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireModule("INVOICES");
    const parsed = softwareItemSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    const item = await prisma.softwareItem.create({ data: parsed.data });
    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
