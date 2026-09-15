import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { eur, formatDate, INTERVAL_LABELS, INVOICE_STATUS_LABELS } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function RecurringDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const template = await prisma.recurringInvoice.findUnique({
    where: { id },
    include: {
      customer: { select: { name: true } },
      invoices: {
        orderBy: [{ issueDate: "desc" }, { createdAt: "desc" }],
        select: {
          id: true,
          number: true,
          status: true,
          issueDate: true,
          dueDate: true,
          grossTotal: true,
        },
      },
    },
  });

  if (!template) notFound();

  return (
    <div className="mx-auto max-w-[100rem]">
      <Link href="/recurring" className="text-sm text-gray-500 hover:text-gray-900">
        ← Zurück zu den Vorlagen
      </Link>

      <div className="mt-2 mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold">{template.name}</h1>
            <span
              className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                template.active
                  ? "border-green-200 bg-green-50 text-green-700"
                  : "border-gray-200 bg-gray-50 text-gray-500"
              }`}
            >
              {template.active ? "Aktiv" : "Pausiert"}
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            {template.customer.name} · {INTERVAL_LABELS[template.interval]} · nächste Ausführung {formatDate(template.nextRun)}
          </p>
        </div>
        <Link
          href={`/recurring/${template.id}/edit`}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium hover:bg-gray-50"
        >
          Vorlage bearbeiten
        </Link>
      </div>

      <div className="mb-3 flex items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Erzeugte Rechnungen</h2>
          <p className="text-sm text-gray-500">
            {template.invoices.length === 1
              ? "1 Rechnung wurde aus dieser Vorlage erstellt."
              : `${template.invoices.length} Rechnungen wurden aus dieser Vorlage erstellt.`}
          </p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
              <th className="px-4 py-3">Nummer</th>
              <th className="px-4 py-3">Datum</th>
              <th className="px-4 py-3">Fällig</th>
              <th className="px-4 py-3 text-right">Brutto</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {template.invoices.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                  Aus dieser Vorlage wurden noch keine Rechnungen erstellt.
                </td>
              </tr>
            )}
            {template.invoices.map((invoice) => {
              const badge = INVOICE_STATUS_LABELS[invoice.status];
              return (
                <tr key={invoice.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">
                    <Link href={`/invoices/${invoice.id}`} className="hover:text-blue-700 hover:underline">
                      {invoice.number ?? "(Entwurf)"}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{formatDate(invoice.issueDate)}</td>
                  <td className="px-4 py-3 text-gray-500">{formatDate(invoice.dueDate)}</td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">
                    {eur.format(Number(invoice.grossTotal))}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${badge.className}`}>
                      {badge.label}
                    </span>
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
