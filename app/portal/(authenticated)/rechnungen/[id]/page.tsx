import Link from "next/link";
import { notFound } from "next/navigation";
import { eur, formatDate, INVOICE_STATUS_LABELS } from "@/lib/format";
import { TAX_NOTES, TAX_TREATMENT_LABELS } from "@/lib/invoices";
import { requirePortalPageSession } from "@/lib/portal-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function PortalInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const [{ email }, { id }] = await Promise.all([requirePortalPageSession(), params]);
  const invoice = await prisma.invoice.findFirst({
    where: {
      id,
      customer: { email: { equals: email, mode: "insensitive" } },
      number: { not: null },
      status: { not: "DRAFT" },
    },
    include: { lines: { orderBy: { position: "asc" } } },
  });
  if (!invoice) notFound();

  const badge = INVOICE_STATUS_LABELS[invoice.status];
  const paid = Number(invoice.paidTotal) + Number(invoice.skontoGranted);
  const outstanding = invoice.type === "INVOICE" && ["OPEN", "SENT"].includes(invoice.status)
    ? Math.max(0, Number(invoice.grossTotal) - paid)
    : 0;

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/portal" className="text-sm font-medium text-slate-500 transition hover:text-slate-950">← Zurück zur Übersicht</Link>
      <div className="mt-5 flex flex-wrap items-start justify-between gap-5">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-semibold tracking-tight">{invoice.type === "CREDIT_NOTE" ? "Gutschrift" : "Rechnung"} {invoice.number}</h1>
            <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${badge.className}`}>{badge.label}</span>
          </div>
          <p className="mt-2 text-sm text-slate-500">Ausgestellt am {formatDate(invoice.issueDate)} · fällig am {formatDate(invoice.dueDate)}</p>
        </div>
        <a href={`/api/portal/invoices/${invoice.id}/pdf`} target="_blank" rel="noreferrer" className="rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-800">
          PDF öffnen
        </a>
      </div>

      <section className="mt-8 grid gap-4 sm:grid-cols-3" aria-label="Beträge">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Gesamtbetrag</p>
          <p className="mt-2 text-xl font-semibold tabular-nums">{eur.format(Number(invoice.grossTotal))}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Bereits beglichen</p>
          <p className="mt-2 text-xl font-semibold tabular-nums text-emerald-700">{eur.format(paid)}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Noch offen</p>
          <p className={`mt-2 text-xl font-semibold tabular-nums ${outstanding > 0 ? "text-amber-700" : "text-slate-950"}`}>{eur.format(outstanding)}</p>
        </div>
      </section>

      <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3 font-medium">Pos.</th>
                <th className="px-5 py-3 font-medium">Leistung</th>
                <th className="px-5 py-3 text-right font-medium">Menge</th>
                <th className="px-5 py-3 text-right font-medium">Einzelpreis</th>
                <th className="px-5 py-3 text-right font-medium">Netto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {invoice.lines.map((line) => (
                <tr key={line.id}>
                  <td className="px-5 py-4 text-slate-500">{line.position}</td>
                  <td className="px-5 py-4 font-medium text-slate-900 whitespace-pre-line">{line.description}</td>
                  <td className="px-5 py-4 text-right tabular-nums text-slate-600">{Number(line.quantity)} {line.unit}</td>
                  <td className="px-5 py-4 text-right tabular-nums text-slate-600">{eur.format(Number(line.unitPrice))}</td>
                  <td className="px-5 py-4 text-right font-medium tabular-nums">{eur.format(Number(line.lineNet))}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-slate-200 bg-slate-50/60">
              <tr><td colSpan={4} className="px-5 pt-4 text-right text-slate-500">Netto</td><td className="px-5 pt-4 text-right font-medium tabular-nums">{eur.format(Number(invoice.netTotal))}</td></tr>
              <tr><td colSpan={4} className="px-5 py-2 text-right text-slate-500">Umsatzsteuer</td><td className="px-5 py-2 text-right font-medium tabular-nums">{eur.format(Number(invoice.taxTotal))}</td></tr>
              <tr><td colSpan={4} className="px-5 pb-4 text-right font-semibold">Gesamt</td><td className="px-5 pb-4 text-right text-base font-bold tabular-nums">{eur.format(Number(invoice.grossTotal))}</td></tr>
            </tfoot>
          </table>
        </div>
      </section>

      <section className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm shadow-sm">
          <h2 className="font-semibold text-slate-900">Rechnungsempfänger</h2>
          <p className="mt-3 font-medium">{invoice.customerName}</p>
          <p className="mt-1 whitespace-pre-line leading-6 text-slate-500">{invoice.customerAddress}</p>
          {invoice.customerUid && <p className="mt-2 text-slate-500">UID: {invoice.customerUid}</p>}
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm shadow-sm">
          <h2 className="font-semibold text-slate-900">Leistungsdetails</h2>
          <p className="mt-3 text-slate-700">{TAX_TREATMENT_LABELS[invoice.taxTreatment]}</p>
          {invoice.servicePeriodStart && invoice.servicePeriodEnd && <p className="mt-2 text-slate-500">Leistungszeitraum: {formatDate(invoice.servicePeriodStart)} – {formatDate(invoice.servicePeriodEnd)}</p>}
          {invoice.taxTreatment !== "STANDARD" && <p className="mt-2 leading-5 text-slate-500">{TAX_NOTES[invoice.taxTreatment]}</p>}
        </div>
      </section>
    </div>
  );
}
