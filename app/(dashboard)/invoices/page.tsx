import { DocumentFilters } from "@/components/document-filters";
import { ListPagination } from "@/components/list-pagination";
import { readListQuery, type ListParams } from "@/lib/list-query";
import { openAmount } from "@/lib/payments";
import { startOfToday } from "@/lib/reminders";
import type { Prisma } from "@/lib/generated/prisma/client";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { eur, formatDate, INVOICE_STATUS_LABELS } from "@/lib/format";
import type { InvoiceStatus } from "@/lib/generated/prisma/enums";

export const dynamic = "force-dynamic";

const STATUSES: InvoiceStatus[] = ["DRAFT", "OPEN", "SENT", "PAID", "CANCELED"];

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<ListParams>;
}) {
  const params = await searchParams;
  const { status } = params;
  const query = readListQuery(params);
  const statusFilter = STATUSES.includes(status as InvoiceStatus)
    ? (status as InvoiceStatus)
    : undefined;

  const where: Prisma.InvoiceWhereInput = {
    status: statusFilter, issueDate: query.dateRange,
    ...(query.q ? { OR: [{ number: { contains: query.q, mode: "insensitive" } }, { customerName: { contains: query.q, mode: "insensitive" } }, { customer: { name: { contains: query.q, mode: "insensitive" } } }, { customer: { customerNumber: { contains: query.q, mode: "insensitive" } } }] } : {}),
  };
  const pagination = query.pagination(await prisma.invoice.count({ where }));
  const orderBy: Prisma.InvoiceOrderByWithRelationInput = query.sort === "number" ? { number: "asc" } : query.sort === "amount_desc" ? { grossTotal: "desc" } : { issueDate: query.sort === "date_asc" ? "asc" : "desc" };
  const invoices = await prisma.invoice.findMany({ where, orderBy: [orderBy, { id: "desc" }], take: pagination.take, skip: pagination.skip, include: { customer: { select: { name: true } } } });
  const today = startOfToday();

  return (
    <div className="mx-auto max-w-[100rem]">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Rechnungen</h1>
          <p className="text-sm text-gray-500">{pagination.total} Rechnungen</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/invoices/new"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            + Neue Rechnung
          </Link>
        </div>
      </div>

      <DocumentFilters params={params} amounts><label className="text-sm font-medium">Status<select name="status" defaultValue={statusFilter ?? ""} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"><option value="">Alle Status</option>{STATUSES.map((s) => <option key={s} value={s}>{INVOICE_STATUS_LABELS[s].label}</option>)}</select></label></DocumentFilters>
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full min-w-[48rem] text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
              <th className="px-4 py-3">Nummer</th>
              <th className="px-4 py-3">Kunde</th>
              <th className="px-4 py-3">Datum</th>
              <th className="px-4 py-3">Fällig</th>
              <th className="px-4 py-3 text-right">Brutto</th>
              <th className="px-4 py-3 text-right">Offen</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {invoices.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                  Keine Rechnungen für diese Filter gefunden.
                </td>
              </tr>
            )}
            {invoices.map((inv) => {
              const badge = INVOICE_STATUS_LABELS[inv.status];
              const receivable = inv.type === "INVOICE" && (inv.status === "OPEN" || inv.status === "SENT" || inv.status === "PAID");
              const overdue = receivable && openAmount(inv) > 0 && inv.dueDate < today;
              return (
                <tr key={inv.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">
                    <Link href={`/invoices/${inv.id}`} className="hover:text-blue-700 hover:underline">
                      {inv.number ?? "(Entwurf)"}
                    </Link>
                    {inv.type === "CREDIT_NOTE" && (
                      <span className="ml-1.5 inline-block rounded-full border border-purple-200 bg-purple-50 px-1.5 py-0.5 text-[10px] font-medium text-purple-700">
                        Storno
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">{inv.customerName || inv.customer.name}</td>
                  <td className="px-4 py-3 text-gray-500">{formatDate(inv.issueDate)}</td>
                  <td className={`px-4 py-3 ${overdue ? "font-medium text-red-700" : "text-gray-500"}`}>{formatDate(inv.dueDate)}{overdue && <span className="block text-xs">Überfällig</span>}</td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">
                    {eur.format(Number(inv.grossTotal))}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">{receivable ? eur.format(Math.max(0, openAmount(inv))) : "–"}</td>
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
      <ListPagination {...pagination} params={params} />
    </div>
  );
}
