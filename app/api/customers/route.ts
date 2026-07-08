import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, handleApiError } from "@/lib/api-helpers";
import { customerSchema } from "@/lib/validation";

export async function GET() {
  try {
    await requireSession();
    const customers = await prisma.customer.findMany({ orderBy: { name: "asc" } });
    return NextResponse.json(customers);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireSession();
    const parsed = customerSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    const customer = await prisma.customer.create({ data: parsed.data });
    return NextResponse.json(customer, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
