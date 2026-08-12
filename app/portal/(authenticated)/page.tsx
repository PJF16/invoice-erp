import Link from "next/link";
import { eur, formatDate, INTERVAL_LABELS, INVOICE_STATUS_LABELS } from "@/lib/format";
import { requirePortalPageSession } from "@/lib/portal-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function currentLinePrice(line: {
  unitPrice: unknown;
  priceAdjustmentType: "ABSOLUTE" | "PERCENTAGE";
  priceAdjustmentValue: unknown;
  priceAdjustmentIsDiscount: boolean;
  softwareItem: { unitPrice: unknown } | null;
}) {
  const base = Number(line.softwareItem?.unitPrice ?? line.unitPrice ?? 0);
  const value = Number(line.priceAdjustmentValue);
  const adjustment = line.priceAdjustmentType === "PERCENTAGE" ? base * (value / 100) : value;
  return Math.max(0, base + (line.priceAdjustmentIsDiscount ? -adjustment : adjustment));
}

export default async function PortalOverviewPage() {
  const { email } = await requirePortalPageSession();
  const customerEmail = { equals: email, mode: "insensitive" as const };
  const [customers, invoices, subscriptions] = await Promise.all([
    prisma.customer.findMany({ where: { email: customerEmail }, select: { name: true } }),
    prisma.invoice.findMany({
      where: {
        customer: { email: customerEmail },
        number: { not: null },
        status: { not: "DRAFT" },
      },
      orderBy: { issueDate: "desc" },
      select: {
        id: true,
        number: true,
        type: true,
        status: true,
        issueDate: true,
        dueDate: true,
        grossTotal: true,
        paidTotal: true,
        skontoGranted: true,
      },
    }),
    prisma.recurringInvoice.findMany({
      where: { customer: { email: customerEmail } },
      orderBy: [{ active: "desc" }, { name: "asc" }],
      include: { lines: { orderBy: { position: "asc" }, include: { softwareItem: true } } },
    }),
  ]);

  const outstanding = invoices.reduce((sum, invoice) => {
    if (invoice.type !== "INVOICE" || !["OPEN", "SENT"].includes(invoice.status)) return sum;
    return sum + Math.max(0, Number(invoice.grossTotal) - Number(invoice.paidTotal) - Number(invoice.skontoGranted));
  }, 0);
  const activeServices = subscriptions.filter((subscription) => subscription.active).length;
  const customerNames = [...new Set(customers.map((customer) => customer.name))];
  const greeting = customerNames.length === 1 ? customerNames[0] : "Willkommen";

  return (
    <div>
      <div className="mb-8">
        <p className="text-sm font-medium text-blue-700">Übersicht</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">Hallo, {greeting}</h1>
        <p className="mt-2 text-sm text-slate-600">Hier finden Sie Ihre Belege und laufenden Dienste auf einen Blick.</p>
      </div>

      <section className="grid gap-4 sm:grid-cols-3" aria-label="Zusammenfassung">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Offener Betrag</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-950">{eur.format(outstanding)}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Belege gesamt</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-950">{invoices.length}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Aktive Dienste</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-950">{activeServices}</p>
        </div>
      </section>

      <section className="mt-10" aria-labelledby="portal-invoices-heading">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <h2 id="portal-invoices-heading" className="text-xl font-semibold tracking-tight">Rechnungen &amp; Belege</h2>
            <p className="mt-1 text-sm text-slate-500">Status, Fälligkeit und PDF-Download</p>
          </div>
        </div>
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {invoices.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-slate-500">Derzeit sind keine Belege für Sie verfügbar.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {invoices.map((invoice) => {
                const badge = INVOICE_STATUS_LABELS[invoice.status];
                const openAmount = Math.max(0, Number(invoice.grossTotal) - Number(invoice.paidTotal) - Number(invoice.skontoGranted));
                return (
                  <Link key={invoice.id} href={`/portal/rechnungen/${invoice.id}`} className="group grid gap-3 px-5 py-4 transition hover:bg-slate-50 sm:grid-cols-[1.2fr_1fr_1fr_auto] sm:items-center">
                    <div>
                      <p className="font-semibold text-slate-900 group-hover:text-blue-700">
                        {invoice.type === "CREDIT_NOTE" ? "Gutschrift" : "Rechnung"} {invoice.number}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">vom {formatDate(invoice.issueDate)}</p>
                    </div>
                    <div>
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${badge.className}`}>{badge.label}</span>
                    </div>
                    <div className="text-sm text-slate-500">
                      <span className="sm:block">Fällig {formatDate(invoice.dueDate)}</span>
                      {openAmount > 0 && <span className="text-xs text-amber-700">Offen: {eur.format(openAmount)}</span>}
                    </div>
                    <p className="text-right font-semibold tabular-nums text-slate-950">{eur.format(Number(invoice.grossTotal))}</p>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <section className="mt-10" aria-labelledby="portal-services-heading">
        <div className="mb-4">
          <h2 id="portal-services-heading" className="text-xl font-semibold tracking-tight">Abonnierte Dienste</h2>
          <p className="mt-1 text-sm text-slate-500">Ihre wiederkehrenden Leistungen und der nächste Abrechnungstermin</p>
        </div>
        {subscriptions.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white px-5 py-10 text-center text-sm text-slate-500 shadow-sm">Derzeit sind keine abonnierten Dienste hinterlegt.</div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {subscriptions.map((subscription) => {
              const monthlyTotal = subscription.lines.reduce((sum, line) => sum + Number(line.quantity) * currentLinePrice(line), 0);
              return (
                <article key={subscription.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="font-semibold text-slate-950">{subscription.name}</h3>
                      <p className="mt-1 text-sm text-slate-500">{INTERVAL_LABELS[subscription.interval]} · nächste Abrechnung {formatDate(subscription.nextRun)}</p>
                    </div>
                    <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium ${subscription.active ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-500"}`}>
                      {subscription.active ? "Aktiv" : "Pausiert"}
                    </span>
                  </div>
                  <div className="mt-5 divide-y divide-slate-100 border-t border-slate-100">
                    {subscription.lines.map((line) => {
                      const positionDescription = line.description?.trim() || line.softwareItem?.description?.trim();
                      return (
                        <div key={line.id} className="flex items-start justify-between gap-4 py-3 text-sm">
                          <div className="min-w-0">
                            <p className="font-medium text-slate-800">{line.softwareItem?.name ?? line.description ?? "Dienstleistung"}</p>
                          {line.softwareItem && positionDescription && (
                            <p className="mt-1 whitespace-pre-line text-xs leading-5 text-slate-500">
                              {positionDescription}
                            </p>
                          )}
                            <p className="mt-0.5 text-xs text-slate-500">{Number(line.quantity)} {line.unit}</p>
                          </div>
                          <p className="shrink-0 font-medium tabular-nums">{eur.format(Number(line.quantity) * currentLinePrice(line))}</p>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex items-center justify-between border-t border-slate-100 pt-4 text-sm">
                    <span className="text-slate-500">Aktueller Nettobetrag</span>
                    <strong className="tabular-nums">{eur.format(monthlyTotal)}</strong>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
