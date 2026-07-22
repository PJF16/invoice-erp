import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { StockActions } from "@/components/stock-actions";

export const dynamic = "force-dynamic";

export default async function StockPage({
  searchParams,
}: {
  searchParams: Promise<{ lager?: string; q?: string }>;
}) {
  const { lager, q } = await searchParams;
  const warehouseFilter = lager || undefined;

  const [warehouses, items, customers] = await Promise.all([
    prisma.warehouse.findMany({ orderBy: { name: "asc" } }),
    prisma.item.findMany({
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
      include: { stocks: { include: { warehouse: true } } },
    }),
    prisma.customer.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, customerNumber: true },
    }),
  ]);

  const rows = items.map((item) => {
    const relevant = warehouseFilter
      ? item.stocks.filter((s) => s.warehouseId === warehouseFilter)
      : item.stocks;
    return {
      id: item.id,
      name: item.name,
      sku: item.sku,
      quantity: relevant.reduce((sum, s) => sum + s.quantity, 0),
      breakdown: item.stocks
        .filter((s) => s.quantity !== 0)
        .map((s) => `${s.warehouse.name}: ${s.quantity}`)
        .join(" · "),
    };
  });

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Bestand</h1>
          <p className="text-sm text-gray-500">
            {warehouseFilter
              ? `Lager: ${warehouses.find((w) => w.id === warehouseFilter)?.name ?? "?"}`
              : "Alle Lager"}
          </p>
        </div>
        <form className="flex flex-wrap gap-2" method="GET">
          <select
            name="lager"
            defaultValue={lager ?? ""}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
          >
            <option value="">Alle Lager</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
          <input
            type="search"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Artikel suchen…"
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
          >
            Filtern
          </button>
        </form>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
              <th className="px-4 py-3">Artikel</th>
              <th className="px-4 py-3">SKU</th>
              <th className="px-4 py-3 text-right">Menge</th>
              <th className="px-4 py-3">Verteilung</th>
              <th className="px-4 py-3 text-right">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                  Keine Artikel gefunden. Lege unter „Artikel“ welche an.
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">
                  <Link href={`/items/${row.id}`} className="hover:text-blue-700 hover:underline">
                    {row.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-gray-500">{row.sku ?? "–"}</td>
                <td
                  className={`px-4 py-3 text-right font-semibold tabular-nums ${
                    row.quantity === 0 ? "text-red-600" : ""
                  }`}
                >
                  {row.quantity}
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">{row.breakdown || "–"}</td>
                <td className="px-4 py-3 text-right">
                  <StockActions
                    itemId={row.id}
                    itemName={row.name}
                    warehouses={warehouses.map((w) => ({ id: w.id, name: w.name }))}
                    customers={customers}
                    defaultWarehouseId={warehouseFilter}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
