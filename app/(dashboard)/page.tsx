import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { eur, INVOICE_STATUS_LABELS } from "@/lib/format";
import { overdueWhere, daysOverdue } from "@/lib/reminders";

export const dynamic = "force-dynamic";

const monthFmt = new Intl.DateTimeFormat("de-AT", { month: "short" });

export default async function DashboardPage() {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Umsatz = finalisierte Rechnungen ohne Stornierte; Stornorechnungen bleiben
  // außen vor, da ihr Original ebenfalls nicht mitzählt (Paar hebt sich auf).
  const revenueWhere = {
    type: "INVOICE" as const,
    status: { in: ["OPEN", "SENT", "PAID"] as ("OPEN" | "SENT" | "PAID")[] },
    number: { not: null },
  };

  const [monthAgg, openInvoices, overdue, revenueInvoices, yearInvoices, latest, itemCount, movementsToday] =
    await Promise.all([
      prisma.invoice.aggregate({
        where: { ...revenueWhere, issueDate: { gte: startOfMonth } },
        _sum: { netTotal: true },
        _count: { _all: true },
      }),
      prisma.invoice.findMany({
        where: { type: "INVOICE", status: { in: ["OPEN", "SENT"] } },
        select: { grossTotal: true, paidTotal: true, skontoGranted: true },
      }),
      prisma.invoice.findMany({
        where: overdueWhere(),
        orderBy: { dueDate: "asc" },
        take: 5,
        include: { customer: { select: { name: true } } },
      }),
      prisma.invoice.findMany({
        where: { ...revenueWhere, issueDate: { gte: sixMonthsAgo } },
        select: { issueDate: true, netTotal: true },
      }),
      prisma.invoice.findMany({
        where: { ...revenueWhere, issueDate: { gte: startOfYear } },
        select: { customerName: true, netTotal: true, customer: { select: { name: true } } },
      }),
      prisma.invoice.findMany({
        orderBy: { createdAt: "desc" },
        take: 6,
        include: { customer: { select: { name: true } } },
      }),
      prisma.item.count(),
      prisma.movement.count({ where: { createdAt: { gte: startOfToday } } }),
    ]);

  const overdueSum = overdue.reduce((sum, i) => sum + Number(i.grossTotal), 0);
  const openSum = openInvoices.reduce(
    (sum, i) => sum + (Number(i.grossTotal) - Number(i.paidTotal) - Number(i.skontoGranted)),
    0,
  );

  // Umsatz je Monat (letzte 6 Monate)
  const months: { key: string; label: string; total: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      key: `${d.getFullYear()}-${d.getMonth()}`,
      label: monthFmt.format(d),
      total: 0,
    });
  }
  for (const inv of revenueInvoices) {
    const d = inv.issueDate;
    const month = months.find((m) => m.key === `${d.getFullYear()}-${d.getMonth()}`);
    if (month) month.total += Number(inv.netTotal);
  }
  const maxMonth = Math.max(...months.map((m) => m.total), 1);

  // Top-Kunden im laufenden Jahr
  const byCustomer = new Map<string, number>();
  for (const inv of yearInvoices) {
    const name = inv.customerName || inv.customer.name;
    byCustomer.set(name, (byCustomer.get(name) ?? 0) + Number(inv.netTotal));
  }
  const topCustomers = [...byCustomer.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const maxCustomer = Math.max(...topCustomers.map(([, v]) => v), 1);

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="mb-6 text-2xl font-semibold">Dashboard</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            Umsatz {monthFmt.format(now)} (netto)
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums">
            {eur.format(Number(monthAgg._sum.netTotal ?? 0))}
          </p>
          <p className="text-xs text-gray-500">{monthAgg._count._all} Rechnungen</p>
        </div>
        <Link href="/offene-posten" className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm hover:border-blue-300">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Offene Posten</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{eur.format(openSum)}</p>
          <p className="text-xs text-gray-500">{openInvoices.length} unbezahlte Rechnungen</p>
        </Link>
        <Link href="/reminders" className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm hover:border-red-300">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Überfällig</p>
          <p className={`mt-1 text-2xl font-bold tabular-nums ${overdue.length > 0 ? "text-red-600" : ""}`}>
            {eur.format(overdueSum)}
          </p>
          <p className="text-xs text-gray-500">
            {overdue.length > 0 ? `${overdue.length} Rechnung(en) → Mahnwesen` : "Nichts überfällig"}
          </p>
        </Link>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Lager</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{itemCount}</p>
          <p className="text-xs text-gray-500">Artikel · {movementsToday} Bewegungen heute</p>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold">Umsatz der letzten 6 Monate</h2>
          <p className="mb-4 text-xs text-gray-500">Netto, ohne stornierte Rechnungen</p>
          <div className="flex items-end gap-3">
            {months.map((m) => (
              <div key={m.key} className="flex flex-1 flex-col items-center gap-1" title={`${m.label}: ${eur.format(m.total)}`}>
                <span className="text-[10px] tabular-nums text-gray-500">
                  {m.total > 0 ? eur.format(m.total).replace(",00", "") : ""}
                </span>
                <div
                  className="w-full max-w-10 rounded-t bg-blue-600"
                  style={{ height: `${Math.max(Math.round((m.total / maxMonth) * 120), m.total > 0 ? 4 : 1)}px` }}
                />
                <span className="text-xs text-gray-500">{m.label}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold">Top-Kunden {now.getFullYear()}</h2>
          <p className="mb-4 text-xs text-gray-500">Nettoumsatz im laufenden Jahr</p>
          {topCustomers.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-500">Noch keine Umsätze.</p>
          ) : (
            <div className="space-y-3">
              {topCustomers.map(([name, total]) => (
                <div key={name}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="truncate font-medium">{name}</span>
                    <span className="ml-2 shrink-0 tabular-nums text-gray-500">{eur.format(total)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-gray-100">
                    <div
                      className="h-2 rounded-full bg-blue-600"
                      style={{ width: `${Math.max((total / maxCustomer) * 100, 2)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3">
            <h2 className="text-sm font-semibold">Letzte Rechnungen</h2>
            <Link href="/invoices" className="text-xs text-blue-600 hover:underline">
              Alle anzeigen →
            </Link>
          </div>
          <table className="w-full text-sm">
            <tbody>
              {latest.length === 0 && (
                <tr>
                  <td className="px-5 py-6 text-center text-gray-500">Noch keine Rechnungen.</td>
                </tr>
              )}
              {latest.map((inv) => {
                const badge = INVOICE_STATUS_LABELS[inv.status];
                return (
                  <tr key={inv.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                    <td className="px-5 py-2.5">
                      <Link href={`/invoices/${inv.id}`} className="font-medium hover:text-blue-700 hover:underline">
                        {inv.number ?? "(Entwurf)"}
                      </Link>
                      {inv.type === "CREDIT_NOTE" && (
                        <span className="ml-1.5 text-xs text-gray-400">Storno</span>
                      )}
                    </td>
                    <td className="px-2 py-2.5 text-gray-500">{inv.customerName || inv.customer.name}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums">{eur.format(Number(inv.grossTotal))}</td>
                    <td className="px-5 py-2.5 text-right">
                      <span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${badge.className}`}>
                        {badge.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3">
            <h2 className="text-sm font-semibold">Überfällige Rechnungen</h2>
            <Link href="/reminders" className="text-xs text-blue-600 hover:underline">
              Zum Mahnwesen →
            </Link>
          </div>
          <table className="w-full text-sm">
            <tbody>
              {overdue.length === 0 && (
                <tr>
                  <td className="px-5 py-6 text-center text-gray-500">
                    Aktuell ist keine Rechnung überfällig. 🎉
                  </td>
                </tr>
              )}
              {overdue.map((inv) => (
                <tr key={inv.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                  <td className="px-5 py-2.5">
                    <Link href={`/invoices/${inv.id}`} className="font-medium hover:text-blue-700 hover:underline">
                      {inv.number}
                    </Link>
                  </td>
                  <td className="px-2 py-2.5 text-gray-500">{inv.customerName || inv.customer.name}</td>
                  <td className="px-2 py-2.5 text-right tabular-nums">{eur.format(Number(inv.grossTotal))}</td>
                  <td className="px-5 py-2.5 text-right text-xs font-medium text-red-600">
                    {daysOverdue(inv.dueDate)} Tage
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}
