import { prisma } from "@/lib/prisma";
import { WarehouseForm, WarehouseRowActions } from "@/components/warehouse-form";

export const dynamic = "force-dynamic";

export default async function WarehousesPage() {
  const warehouses = await prisma.warehouse.findMany({
    orderBy: { name: "asc" },
    include: { stocks: true },
  });

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Lager</h1>
          <p className="text-sm text-gray-500">{warehouses.length} Lager angelegt</p>
        </div>
        <WarehouseForm />
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Standort</th>
              <th className="px-4 py-3 text-right">Artikel im Bestand</th>
              <th className="px-4 py-3 text-right">Gesamtmenge</th>
              <th className="px-4 py-3 text-right">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {warehouses.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                  Noch keine Lager angelegt.
                </td>
              </tr>
            )}
            {warehouses.map((w) => (
              <tr key={w.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{w.name}</td>
                <td className="px-4 py-3 text-gray-500">{w.location ?? "–"}</td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {w.stocks.filter((s) => s.quantity > 0).length}
                </td>
                <td className="px-4 py-3 text-right font-semibold tabular-nums">
                  {w.stocks.reduce((sum, s) => sum + s.quantity, 0)}
                </td>
                <td className="px-4 py-3 text-right">
                  <WarehouseRowActions
                    warehouse={{ id: w.id, name: w.name, location: w.location }}
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
