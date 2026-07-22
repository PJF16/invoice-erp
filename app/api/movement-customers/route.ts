import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleApiError, requireModule } from "@/lib/api-helpers";

export async function GET() {
  try {
    await requireModule("STOCK");
    const customers = await prisma.customer.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, customerNumber: true },
    });
    return NextResponse.json(customers);
  } catch (error) {
    return handleApiError(error);
  }
}
