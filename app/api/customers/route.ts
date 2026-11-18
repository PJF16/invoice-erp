import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireModule, handleApiError, getPagination } from "@/lib/api-helpers";
import { customerDisplayName, customerSchema } from "@/lib/validation";
import { customerSearchWhere } from "@/lib/customer-search";

export async function GET(req: NextRequest) {
  try {
    await requireModule("INVOICES");
    const customers = await prisma.customer.findMany({
      where: customerSearchWhere(req.nextUrl.searchParams.get("q")),
      orderBy: [{ name: "asc" }, { id: "asc" }],
      ...getPagination(req.nextUrl.searchParams, { limit: 200, max: 500 }),
    });
    return NextResponse.json(customers);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireModule("INVOICES");
    const parsed = customerSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    const customer = await prisma.customer.create({
      data: { ...parsed.data, name: customerDisplayName(parsed.data) },
    });
    return NextResponse.json(customer, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
