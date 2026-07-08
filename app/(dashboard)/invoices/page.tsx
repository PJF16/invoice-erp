import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { eur, formatDate, INVOICE_STATUS_LABELS } from "@/lib/format";
import type { InvoiceStatus } from "@/lib/generated/prisma/enums";

export const dynamic = "force-dynamic";

const STATUSES: InvoiceStatus[] = ["DRAFT", "OPEN", "SENT", "PAID", "CANCELED"];

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const statusFilter = STATUSES.includes(status as InvoiceStatus)
    ? (status as InvoiceStatus)
    : undefined;

  const invoices = await prisma.invoice.findMany({
    where: statusFilter ? { status: statusFilter } : undefined,
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { customer: { select: { name: true } } },
  });

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Rechnungen</h1>
          <p className="text-sm text-gray-500">{invoices.length} Rechnungen</p>
        </div>
        <div className="flex gap-2">
          <form method="GET">
            <select
              name="status"
              defaultValue={status ?? ""}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
            >
              <option value="">Alle Status</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {INVOICE_STATUS_LABELS[s].label}
                </option>
              ))}
            </select>
            <button type="submit" className="ml-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700">
              Filtern
            </button>
          </form>
          <Link
            href="/invoices/new"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            + Neue Rechnung
          </Link>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
              <th className="px-4 py-3">Nummer</th>
              <th className="px-4 py-3">Kunde</th>
              <th className="px-4 py-3">Datum</th>
              <th className="px-4 py-3">Fällig</th>
              <th className="px-4 py-3 text-right">Brutto</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {invoices.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  Noch keine Rechnungen.
                </td>
              </tr>
            )}
            {invoices.map((inv) => {
              const badge = INVOICE_STATUS_LABELS[inv.status];
              return (
                <tr key={inv.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">
                    <Link href={`/invoices/${inv.id}`} className="hover:text-blue-700 hover:underline">
                      {inv.number ?? "(Entwurf)"}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{inv.customerName || inv.customer.name}</td>
                  <td className="px-4 py-3 text-gray-500">{formatDate(inv.issueDate)}</td>
                  <td className="px-4 py-3 text-gray-500">{formatDate(inv.dueDate)}</td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">
                    {eur.format(Number(inv.grossTotal))}
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
