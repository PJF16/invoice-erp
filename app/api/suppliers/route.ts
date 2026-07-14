import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireModule, handleApiError } from "@/lib/api-helpers";

// Alle bisher verwendeten Lieferantennamen (für Autocomplete in Web und iOS).
export async function GET() {
  try {
    await requireModule("STOCK");
    const rows = await prisma.movement.findMany({
      where: { supplier: { not: null } },
      select: { supplier: true },
      distinct: ["supplier"],
      orderBy: { supplier: "asc" },
    });
    return NextResponse.json(rows.map((r) => r.supplier));
  } catch (error) {
    return handleApiError(error);
  }
}
