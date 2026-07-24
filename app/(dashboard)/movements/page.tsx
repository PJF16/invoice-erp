import Link from "next/link";
import { prisma } from "@/lib/prisma";
import type { MovementBillingStatus, MovementType } from "@/lib/generated/prisma/enums";

export const dynamic = "force-dynamic";

const typeLabels: Record<MovementType, { label: string; className: string }> = {
  IN: { label: "Eingang", className: "bg-green-50 text-green-700 border-green-200" },
  OUT: { label: "Ausgang", className: "bg-red-50 text-red-700 border-red-200" },
  ADJUST: { label: "Korrektur", className: "bg-amber-50 text-amber-700 border-amber-200" },
};

const billingLabels: Record<MovementBillingStatus, string> = {
  PENDING: "Ausstehend",
  INVOICED: "Verrechnet",
  GIFTED: "Verschenkt",
};

export default async function MovementsPage({
  searchParams,
}: {
  searchParams: Promise<{ lager?: string; typ?: string }>;
}) {
  const { lager, typ } = await searchParams;
  const type = typ === "IN" || typ === "OUT" || typ === "ADJUST" ? typ : undefined;

  const [warehouses, movements] = await Promise.all([
    prisma.warehouse.findMany({ orderBy: { name: "asc" } }),
    prisma.movement.findMany({
      where: { warehouseId: lager || undefined, type },
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        item: { select: { name: true, sku: true } },
        warehouse: { select: { name: true } },
        user: { select: { name: true } },
        customer: { select: { name: true } },
        deliveryNoteLine: { select: { deliveryNote: { select: { id: true, number: true } } } },
      },
    }),
  ]);

  const dateFormat = new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Historie</h1>
          <p className="text-sm text-gray-500">Letzte {movements.length} Bewegungen</p>
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
          <select
            name="typ"
            defaultValue={typ ?? ""}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
          >
            <option value="">Alle Typen</option>
            <option value="IN">Eingang</option>
            <option value="OUT">Ausgang</option>
            <option value="ADJUST">Korrektur</option>
          </select>
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
              <th className="px-4 py-3">Zeitpunkt</th>
              <th className="px-4 py-3">Typ</th>
              <th className="px-4 py-3">Artikel</th>
              <th className="px-4 py-3 text-right">Menge</th>
              <th className="px-4 py-3">Lager</th>
              <th className="px-4 py-3">Lieferant</th>
              <th className="px-4 py-3">Kunde</th>
              <th className="px-4 py-3">Verrechnung</th>
              <th className="px-4 py-3">Lieferschein</th>
              <th className="px-4 py-3">Benutzer</th>
              <th className="px-4 py-3">Notiz</th>
            </tr>
          </thead>
          <tbody>
            {movements.length === 0 && (
              <tr>
                <td colSpan={11} className="px-4 py-8 text-center text-gray-500">
                  Noch keine Bewegungen.
                </td>
              </tr>
            )}
            {movements.map((m) => (
              <tr key={m.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                <td className="px-4 py-3 whitespace-nowrap text-gray-500">
                  {dateFormat.format(m.createdAt)}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${typeLabels[m.type].className}`}
                  >
                    {typeLabels[m.type].label}
                  </span>
                </td>
                <td className="px-4 py-3 font-medium">{m.item.name}</td>
                <td className="px-4 py-3 text-right font-semibold tabular-nums">
                  {m.type === "OUT" ? "−" : m.type === "IN" ? "+" : "±"}
                  {Math.abs(m.quantity)}
                </td>
                <td className="px-4 py-3 text-gray-500">{m.warehouse.name}</td>
                <td className="px-4 py-3 text-gray-500">{m.supplier ?? "–"}</td>
                <td className="px-4 py-3 text-gray-500">{m.customer?.name ?? "–"}</td>
                <td className="px-4 py-3 text-gray-500">{m.billingStatus ? billingLabels[m.billingStatus] : "–"}</td>
                <td className="px-4 py-3">{m.deliveryNoteLine ? <Link href={`/delivery-notes/${m.deliveryNoteLine.deliveryNote.id}`} className="text-blue-700 hover:underline">{m.deliveryNoteLine.deliveryNote.number}</Link> : <span className="text-gray-400">–</span>}</td>
                <td className="px-4 py-3 text-gray-500">{m.user.name}</td>
                <td className="px-4 py-3 text-xs text-gray-500">{m.note ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
