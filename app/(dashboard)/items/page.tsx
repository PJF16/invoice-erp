import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ItemForm, ItemRowActions } from "@/components/item-form";

export const dynamic = "force-dynamic";

export default async function ItemsPage() {
  const items = await prisma.item.findMany({
    orderBy: { name: "asc" },
    include: { stocks: true },
  });

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Artikel</h1>
          <p className="text-sm text-gray-500">{items.length} Artikel angelegt</p>
        </div>
        <ItemForm />
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">SKU</th>
              <th className="px-4 py-3">Barcode</th>
              <th className="px-4 py-3 text-right">Gesamtbestand</th>
              <th className="px-4 py-3 text-right">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                  Noch keine Artikel. Lege den ersten an.
                </td>
              </tr>
            )}
            {items.map((item) => (
              <tr key={item.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">
                  <Link href={`/items/${item.id}`} className="hover:text-blue-700 hover:underline">
                    {item.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-gray-500">{item.sku ?? "–"}</td>
                <td className="px-4 py-3 font-mono text-xs break-all text-gray-500">{item.barcode ?? "–"}</td>
                <td className="px-4 py-3 text-right font-semibold tabular-nums">
                  {item.stocks.reduce((sum, s) => sum + s.quantity, 0)}
                </td>
                <td className="px-4 py-3 text-right">
                  <ItemRowActions
                    item={{
                      id: item.id,
                      name: item.name,
                      sku: item.sku,
                      barcode: item.barcode,
                      description: item.description,
                    }}
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
