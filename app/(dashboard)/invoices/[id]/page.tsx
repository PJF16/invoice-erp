import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { eur, formatDate, INVOICE_STATUS_LABELS } from "@/lib/format";
import { TAX_NOTES, TAX_TREATMENT_LABELS } from "@/lib/invoices";
import { skontoDeadline } from "@/lib/payments";
import { InvoiceActions } from "@/components/invoice-actions";
import { InvoicePayments } from "@/components/invoice-payments";

export const dynamic = "force-dynamic";

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      lines: { orderBy: { position: "asc" } },
      customer: true,
      payments: { orderBy: { date: "asc" } },
      recurringInvoice: { select: { id: true, name: true } },
      sourceOffer: { select: { id: true, number: true } },
      relatedInvoice: { select: { id: true, number: true } },
      stornoInvoices: { select: { id: true, number: true } },
    },
  });
  if (!invoice) notFound();

  const showPayments =
    invoice.type === "INVOICE" && invoice.status !== "DRAFT" && invoice.status !== "CANCELED";
  const deadline = skontoDeadline(invoice);

  const badge = INVOICE_STATUS_LABELS[invoice.status];
  const customerName = invoice.customerName || invoice.customer.name;

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/invoices" className="text-sm text-gray-500 hover:text-gray-900">
        ← Zurück zu den Rechnungen
      </Link>
      <div className="mt-2 mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold">
              {invoice.type === "CREDIT_NOTE" ? "Stornorechnung" : "Rechnung"} {invoice.number ?? "(Entwurf)"}
            </h1>
            <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium ${badge.className}`}>
              {badge.label}
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            {customerName} · {formatDate(invoice.issueDate)} · fällig {formatDate(invoice.dueDate)}
            {invoice.sentAt && <> · versendet {formatDate(invoice.sentAt)}</>}
            {invoice.paidAt && <> · bezahlt {formatDate(invoice.paidAt)}</>}
          </p>
          {invoice.recurringInvoice && (
            <p className="mt-1 text-xs text-gray-400">
              Automatisch erzeugt aus Vorlage „{invoice.recurringInvoice.name}“
            </p>
          )}
          {invoice.sourceOffer && (
            <p className="mt-1 text-xs text-violet-700">
              Erstellt aus <Link href={`/offers/${invoice.sourceOffer.id}`} className="hover:underline">Angebot {invoice.sourceOffer.number}</Link>
            </p>
          )}
          {invoice.relatedInvoice && (
            <p className="mt-1 text-sm text-gray-500">
              Storno zu{" "}
              <Link href={`/invoices/${invoice.relatedInvoice.id}`} className="text-blue-600 hover:underline">
                Rechnung {invoice.relatedInvoice.number}
              </Link>
            </p>
          )}
          {invoice.stornoInvoices.length > 0 && (
            <p className="mt-1 text-sm text-gray-500">
              Storniert durch{" "}
              <Link href={`/invoices/${invoice.stornoInvoices[0].id}`} className="text-blue-600 hover:underline">
                Stornorechnung {invoice.stornoInvoices[0].number}
              </Link>
            </p>
          )}
        </div>
        <InvoiceActions
          invoice={{
            id: invoice.id,
            status: invoice.status,
            type: invoice.type,
            number: invoice.number,
            customerEmail: invoice.customer.email,
          }}
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-2 text-sm font-semibold">Empfänger</h2>
          <p className="text-sm font-medium">{customerName}</p>
          <p className="text-sm whitespace-pre-line text-gray-500">
            {invoice.customerAddress ||
              [invoice.customer.street, `${invoice.customer.zip} ${invoice.customer.city}`.trim(), invoice.customer.country]
                .filter(Boolean)
                .join("\n")}
          </p>
          {(invoice.customerUid ?? invoice.customer.uid) && (
            <p className="mt-1 text-sm text-gray-500">UID: {invoice.customerUid ?? invoice.customer.uid}</p>
          )}
        </section>
        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-2 text-sm font-semibold">Steuer &amp; Zeitraum</h2>
          <p className="text-sm">{TAX_TREATMENT_LABELS[invoice.taxTreatment]}</p>
          {invoice.taxTreatment !== "STANDARD" && (
            <p className="mt-1 text-xs text-gray-500">{TAX_NOTES[invoice.taxTreatment]}</p>
          )}
          {invoice.servicePeriodStart && invoice.servicePeriodEnd && (
            <p className="mt-2 text-sm text-gray-500">
              Leistungszeitraum: {formatDate(invoice.servicePeriodStart)} – {formatDate(invoice.servicePeriodEnd)}
            </p>
          )}
        </section>
      </div>

      <section className="mt-6 overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
              <th className="px-4 py-3">Pos</th>
              <th className="px-4 py-3">Bezeichnung</th>
              <th className="px-4 py-3 text-right">Menge</th>
              <th className="px-4 py-3 text-right">Einzelpreis</th>
              <th className="px-4 py-3 text-right">USt</th>
              <th className="px-4 py-3 text-right">Netto</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lines.map((line) => (
              <tr key={line.id} className="border-b border-gray-100 last:border-0">
                <td className="px-4 py-3 text-gray-500">{line.position}</td>
                <td className="px-4 py-3 font-medium">{line.description}</td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {Number(line.quantity)} {line.unit}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{eur.format(Number(line.unitPrice))}</td>
                <td className="px-4 py-3 text-right tabular-nums">{line.taxRate}%</td>
                <td className="px-4 py-3 text-right font-semibold tabular-nums">{eur.format(Number(line.lineNet))}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-gray-200 text-sm">
              <td colSpan={5} className="px-4 py-2 text-right text-gray-500">
                Netto
              </td>
              <td className="px-4 py-2 text-right font-semibold tabular-nums">{eur.format(Number(invoice.netTotal))}</td>
            </tr>
            <tr className="text-sm">
              <td colSpan={5} className="px-4 py-2 text-right text-gray-500">
                USt
              </td>
              <td className="px-4 py-2 text-right font-semibold tabular-nums">{eur.format(Number(invoice.taxTotal))}</td>
            </tr>
            <tr className="text-base">
              <td colSpan={5} className="px-4 py-3 text-right font-semibold">
                Brutto
              </td>
              <td className="px-4 py-3 text-right font-bold tabular-nums">{eur.format(Number(invoice.grossTotal))}</td>
            </tr>
          </tfoot>
        </table>
      </section>

      {showPayments && (
        <InvoicePayments
          invoiceId={invoice.id}
          grossTotal={Number(invoice.grossTotal)}
          paidTotal={Number(invoice.paidTotal)}
          skontoGranted={Number(invoice.skontoGranted)}
          skontoPercent={invoice.skontoPercent}
          skontoDeadline={deadline ? deadline.toISOString() : null}
          status={invoice.status}
          payments={invoice.payments.map((p) => ({
            id: p.id,
            amount: Number(p.amount),
            date: p.date.toISOString(),
            method: p.method,
            reference: p.reference,
            note: p.note,
          }))}
        />
      )}

      {invoice.notes && (
        <section className="mt-6 rounded-xl border border-gray-200 bg-white p-5 text-sm text-gray-600 shadow-sm">
          {invoice.notes}
        </section>
      )}
    </div>
  );
}
