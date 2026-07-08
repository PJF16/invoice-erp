import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { StockActions } from "@/components/stock-actions";

export const dynamic = "force-dynamic";

export default async function ItemDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [item, warehouses, supplierGroups] = await Promise.all([
    prisma.item.findUnique({
      where: { id },
      include: {
        stocks: { include: { warehouse: true }, orderBy: { warehouse: { name: "asc" } } },
        movements: {
          orderBy: { createdAt: "desc" },
          take: 20,
          include: { warehouse: { select: { name: true } }, user: { select: { name: true } } },
        },
      },
    }),
    prisma.warehouse.findMany({ orderBy: { name: "asc" } }),
    prisma.movement.groupBy({
      by: ["supplier"],
      where: { itemId: id, type: "IN", supplier: { not: null } },
      _sum: { quantity: true },
      _count: { _all: true },
      _max: { createdAt: true },
    }),
  ]);

  if (!item) notFound();

  const total = item.stocks.reduce((sum, s) => sum + s.quantity, 0);
  const dateFormat = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" });
  const suppliers = supplierGroups.sort((a, b) =>
    (b._max.createdAt?.getTime() ?? 0) - (a._max.createdAt?.getTime() ?? 0),
  );

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/" className="text-sm text-gray-500 hover:text-gray-900">
        ← Zurück zum Bestand
      </Link>
      <div className="mt-2 mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{item.name}</h1>
          <p className="text-sm text-gray-500">
            {item.sku && <>SKU: {item.sku} · </>}
            {item.barcode && <>Barcode: {item.barcode} · </>}
            Gesamt: <span className="font-semibold text-gray-900">{total}</span> Stück
          </p>
          {item.description && <p className="mt-1 text-sm text-gray-500">{item.description}</p>}
        </div>
        <StockActions
          itemId={item.id}
          itemName={item.name}
          warehouses={warehouses.map((w) => ({ id: w.id, name: w.name }))}
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <h2 className="border-b border-gray-200 px-4 py-3 text-sm font-semibold">
            Bestand pro Lager
          </h2>
          <table className="w-full text-sm">
            <tbody>
              {item.stocks.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-center text-gray-500">Noch kein Bestand.</td>
                </tr>
              )}
              {item.stocks.map((s) => (
                <tr key={s.id} className="border-b border-gray-100 last:border-0">
                  <td className="px-4 py-2.5">{s.warehouse.name}</td>
                  <td className="px-4 py-2.5 text-right font-semibold tabular-nums">
                    {s.quantity}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <h2 className="border-b border-gray-200 px-4 py-3 text-sm font-semibold">Lieferanten</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="px-4 py-2">Lieferant</th>
                <th className="px-4 py-2 text-right">Lieferungen</th>
                <th className="px-4 py-2 text-right">Menge</th>
                <th className="px-4 py-2 text-right">Zuletzt</th>
              </tr>
            </thead>
            <tbody>
              {suppliers.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-gray-500">
                    Noch keine Lieferanten erfasst.
                  </td>
                </tr>
              )}
              {suppliers.map((s) => (
                <tr key={s.supplier} className="border-b border-gray-100 last:border-0">
                  <td className="px-4 py-2.5 font-medium">{s.supplier}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{s._count._all}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{s._sum.quantity}</td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap text-xs text-gray-500">
                    {s._max.createdAt
                      ? new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(
                          s._max.createdAt,
                        )
                      : "–"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>

      <section className="mt-6 overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <h2 className="border-b border-gray-200 px-4 py-3 text-sm font-semibold">
          Letzte Bewegungen
        </h2>
        <table className="w-full text-sm">
          <tbody>
            {item.movements.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-center text-gray-500">Noch keine Bewegungen.</td>
              </tr>
            )}
            {item.movements.map((m) => (
              <tr key={m.id} className="border-b border-gray-100 last:border-0">
                <td className="px-4 py-2.5 whitespace-nowrap text-gray-500">
                  {dateFormat.format(m.createdAt)}
                </td>
                <td
                  className={`px-4 py-2.5 text-right font-semibold tabular-nums ${
                    m.type === "OUT" ? "text-red-600" : m.type === "IN" ? "text-green-700" : "text-amber-600"
                  }`}
                >
                  {m.type === "OUT" ? "−" : m.type === "IN" ? "+" : "±"}
                  {Math.abs(m.quantity)}
                </td>
                <td className="px-4 py-2.5 text-gray-500">{m.warehouse.name}</td>
                <td className="px-4 py-2.5 text-gray-500">{m.supplier ?? ""}</td>
                <td className="px-4 py-2.5 text-gray-500">{m.user.name}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
