import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { eur, formatDate } from "@/lib/format";
import { daysOverdue, startOfToday } from "@/lib/reminders";
import { openAmount } from "@/lib/payments";

export const dynamic = "force-dynamic";

// Fälligkeits-Alter (Aging) offener Forderungen.
const BUCKETS = [
  { key: "current", label: "Nicht fällig", className: "text-gray-700" },
  { key: "d1_30", label: "1–30 Tage", className: "text-amber-600" },
  { key: "d31_60", label: "31–60 Tage", className: "text-amber-700" },
  { key: "d61_90", label: "61–90 Tage", className: "text-red-600" },
  { key: "d90", label: "> 90 Tage", className: "text-red-700" },
] as const;

type BucketKey = (typeof BUCKETS)[number]["key"];

function bucketOf(dueDate: Date): BucketKey {
  const days = daysOverdue(dueDate);
  if (days === 0 && dueDate >= startOfToday()) return "current";
  if (days <= 30) return "d1_30";
  if (days <= 60) return "d31_60";
  if (days <= 90) return "d61_90";
  return "d90";
}

export default async function OpenItemsPage() {
  const invoices = await prisma.invoice.findMany({
    where: { type: "INVOICE", status: { in: ["OPEN", "SENT"] } },
    orderBy: { dueDate: "asc" },
    include: { customer: { select: { name: true } } },
  });

  const rows = invoices.map((inv) => ({
    inv,
    open: openAmount(inv),
    bucket: bucketOf(inv.dueDate),
  }));

  const totalOpen = rows.reduce((sum, r) => sum + r.open, 0);
  const bucketSums = new Map<BucketKey, number>();
  for (const r of rows) bucketSums.set(r.bucket, (bucketSums.get(r.bucket) ?? 0) + r.open);

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Offene Posten</h1>
        <p className="text-sm text-gray-500">
          {rows.length > 0
            ? `${rows.length} unbezahlte Rechnung(en) über ${eur.format(totalOpen)}`
            : "Keine offenen Forderungen."}
        </p>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {BUCKETS.map((b) => (
          <div key={b.key} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-xs text-gray-500">{b.label}</p>
            <p className={`mt-1 text-lg font-semibold tabular-nums ${b.className}`}>
              {eur.format(bucketSums.get(b.key) ?? 0)}
            </p>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
              <th className="px-4 py-3">Nummer</th>
              <th className="px-4 py-3">Kunde</th>
              <th className="px-4 py-3">Fällig</th>
              <th className="px-4 py-3">Alter</th>
              <th className="px-4 py-3 text-right">Brutto</th>
              <th className="px-4 py-3 text-right">Bezahlt</th>
              <th className="px-4 py-3 text-right">Offen</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-gray-500">
                  Alle Rechnungen sind bezahlt. 🎉
                </td>
              </tr>
            )}
            {rows.map(({ inv, open, bucket }) => {
              const days = daysOverdue(inv.dueDate);
              const b = BUCKETS.find((x) => x.key === bucket)!;
              return (
                <tr key={inv.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">
                    <Link href={`/invoices/${inv.id}`} className="hover:text-blue-700 hover:underline">
                      {inv.number}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{inv.customerName || inv.customer.name}</td>
                  <td className="px-4 py-3 text-gray-500">{formatDate(inv.dueDate)}</td>
                  <td className={`px-4 py-3 text-xs font-medium ${b.className}`}>
                    {days > 0 ? `${days} Tage überfällig` : b.label}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-500">
                    {eur.format(Number(inv.grossTotal))}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-500">
                    {eur.format(Number(inv.paidTotal) + Number(inv.skontoGranted))}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">{eur.format(open)}</td>
                </tr>
              );
            })}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="border-t border-gray-200 font-semibold">
                <td colSpan={6} className="px-4 py-3 text-right">
                  Summe offen
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{eur.format(totalOpen)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
