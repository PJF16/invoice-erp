import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, handleApiError } from "@/lib/api-helpers";

// Bestand pro Artikel, optional gefiltert nach Lager (?warehouseId=) und Suche (?q=).
export async function GET(req: NextRequest) {
  try {
    await requireSession();
    const warehouseId = req.nextUrl.searchParams.get("warehouseId") ?? undefined;
    const q = req.nextUrl.searchParams.get("q")?.trim();

    const items = await prisma.item.findMany({
      where: q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { sku: { contains: q, mode: "insensitive" } },
              { barcode: { contains: q, mode: "insensitive" } },
            ],
          }
        : undefined,
      orderBy: { name: "asc" },
      include: {
        stocks: {
          where: warehouseId ? { warehouseId } : undefined,
          include: { warehouse: { select: { id: true, name: true } } },
        },
      },
    });

    const result = items.map((item) => ({
      id: item.id,
      name: item.name,
      sku: item.sku,
      barcode: item.barcode,
      total: item.stocks.reduce((sum, s) => sum + s.quantity, 0),
      stocks: item.stocks.map((s) => ({
        warehouseId: s.warehouseId,
        warehouse: s.warehouse.name,
        quantity: s.quantity,
      })),
    }));

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
