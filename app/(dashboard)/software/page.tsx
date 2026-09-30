import { prisma } from "@/lib/prisma";
import { eur } from "@/lib/format";
import { SoftwareForm, SoftwareRowActions } from "@/components/software-form";

export const dynamic = "force-dynamic";

export default async function SoftwarePage() {
  const items = await prisma.softwareItem.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { recurringLines: true } } },
  });

  return (
    <div className="mx-auto max-w-[100rem]">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Software & Dienstleistungen</h1>
          <p className="text-sm text-gray-500">
            Preisänderungen wirken automatisch auf alle künftig erzeugten wiederkehrenden Rechnungen.
          </p>
        </div>
        <div className="flex flex-wrap gap-2"><SoftwareForm /></div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Typ</th>
              <th className="px-4 py-3">Beschreibung</th>
              <th className="px-4 py-3 text-right">Preis (netto)</th>
              <th className="px-4 py-3">Einheit</th>
              <th className="px-4 py-3">Leistungsart</th>
              <th className="px-4 py-3 text-right">In Abos</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                  Noch keine Softwareartikel oder Dienstleistungen angelegt.
                </td>
              </tr>
            )}
            {items.map((item) => (
              <tr key={item.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{item.name}</td>
                <td className="px-4 py-3 text-gray-500">{item.catalogType === "SERVICE" ? "Dienstleistung" : "Software"}</td>
                <td className="px-4 py-3 text-xs text-gray-500">{item.description ?? "–"}</td>
                <td className="px-4 py-3 text-right font-semibold tabular-nums">
                  {eur.format(Number(item.unitPrice))}
                </td>
                <td className="px-4 py-3 text-gray-500">{item.unit}</td>
                <td className="px-4 py-3 text-xs text-gray-500">
                  {item.supplyKind === "ELECTRONIC_SERVICE" ? "Elektronische Dienstleistung" : "Dienstleistung"}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{item._count.recurringLines}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${
                      item.active
                        ? "border-green-200 bg-green-50 text-green-700"
                        : "border-gray-200 bg-gray-50 text-gray-500"
                    }`}
                  >
                    {item.active ? "Aktiv" : "Inaktiv"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <SoftwareRowActions
                    item={{
                      id: item.id,
                      name: item.name,
                      description: item.description,
                      unitPrice: Number(item.unitPrice),
                      unit: item.unit,
                      active: item.active,
                      supplyKind: item.supplyKind,
                      catalogType: item.catalogType,
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
