import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { eur, formatDate, INTERVAL_LABELS } from "@/lib/format";
import { RecurringRowActions } from "@/components/recurring-actions";

export const dynamic = "force-dynamic";

export default async function RecurringPage() {
  const templates = await prisma.recurringInvoice.findMany({
    orderBy: { name: "asc" },
    include: {
      customer: { select: { name: true, email: true } },
      lines: { include: { softwareItem: true } },
      _count: { select: { invoices: true } },
    },
  });

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Wiederkehrende Rechnungen</h1>
          <p className="text-sm text-gray-500">
            Werden automatisch erzeugt und versendet. Softwareartikel-Preise werden bei jeder Erzeugung neu gelesen.
          </p>
        </div>
        <Link
          href="/recurring/new"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          + Neue Vorlage
        </Link>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Kunde</th>
              <th className="px-4 py-3">Intervall</th>
              <th className="px-4 py-3">Nächste Ausführung</th>
              <th className="px-4 py-3 text-right">Netto (aktuell)</th>
              <th className="px-4 py-3">Auto-Versand</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {templates.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                  Noch keine Vorlagen. Lege z.B. einen monatlichen Wartungsvertrag an.
                </td>
              </tr>
            )}
            {templates.map((t) => {
              const net = t.lines.reduce((sum, l) => {
                const price = l.softwareItem ? Number(l.softwareItem.unitPrice) : Number(l.unitPrice ?? 0);
                return sum + Number(l.quantity) * price;
              }, 0);
              return (
                <tr key={t.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">
                    <Link href={`/recurring/${t.id}/edit`} className="hover:text-blue-700 hover:underline">
                      {t.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{t.customer.name}</td>
                  <td className="px-4 py-3 text-gray-500">{INTERVAL_LABELS[t.interval]}</td>
                  <td className="px-4 py-3 text-gray-500">{formatDate(t.nextRun)}</td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">{eur.format(net)}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {t.autoSend ? (t.customer.email ? "Ja" : "Ja (keine E-Mail!)") : "Nein"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${
                        t.active
                          ? "border-green-200 bg-green-50 text-green-700"
                          : "border-gray-200 bg-gray-50 text-gray-500"
                      }`}
                    >
                      {t.active ? "Aktiv" : "Pausiert"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <RecurringRowActions id={t.id} name={t.name} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
