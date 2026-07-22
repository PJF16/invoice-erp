import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { eur, formatDate, OFFER_STATUS_LABELS } from "@/lib/format";
import { TAX_NOTES, TAX_TREATMENT_LABELS } from "@/lib/invoices";
import { OfferActions } from "@/components/offer-actions";

export const dynamic = "force-dynamic";

export default async function OfferDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const offer = await prisma.offer.findUnique({
    where: { id },
    include: {
      customer: true,
      lines: { orderBy: { position: "asc" } },
      convertedInvoice: { select: { id: true, number: true, status: true } },
    },
  });
  if (!offer) notFound();
  const badge = OFFER_STATUS_LABELS[offer.status];
  const customerName = offer.customerName || offer.customer.name;
  const expired = offer.status === "OPEN" && offer.validUntil < new Date();
  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/offers" className="text-sm text-gray-500 hover:text-gray-900">← Zurück zu den Angeboten</Link>
      <div className="mt-2 mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold">Angebot {offer.number ?? "(Entwurf)"}</h1>
            <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium ${badge.className}`}>{badge.label}</span>
          </div>
          <p className="mt-1 text-sm text-gray-500">{customerName} · {formatDate(offer.issueDate)} · gültig bis <span className={expired ? "font-medium text-red-600" : ""}>{formatDate(offer.validUntil)}{expired ? " (abgelaufen)" : ""}</span></p>
          {offer.convertedInvoice && (
            <p className="mt-1 text-sm text-violet-700">Umgewandelt in <Link href={`/invoices/${offer.convertedInvoice.id}`} className="font-medium hover:underline">Rechnung {offer.convertedInvoice.number ?? "(Entwurf)"}</Link></p>
          )}
        </div>
        <OfferActions offer={{ id: offer.id, status: offer.status }} />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-2 text-sm font-semibold">Empfänger</h2>
          <p className="text-sm font-medium">{customerName}</p>
          <p className="whitespace-pre-line text-sm text-gray-500">{offer.customerAddress || [offer.customer.street, `${offer.customer.zip} ${offer.customer.city}`.trim(), offer.customer.country].filter(Boolean).join("\n")}</p>
          {(offer.customerUid ?? offer.customer.uid) && <p className="mt-1 text-sm text-gray-500">UID: {offer.customerUid ?? offer.customer.uid}</p>}
        </section>
        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-2 text-sm font-semibold">Steuer &amp; Gültigkeit</h2>
          <p className="text-sm">{TAX_TREATMENT_LABELS[offer.taxTreatment]}</p>
          {offer.taxTreatment !== "STANDARD" && <p className="mt-1 text-xs text-gray-500">{TAX_NOTES[offer.taxTreatment]}</p>}
          <p className="mt-2 text-sm text-gray-500">Gültig bis {formatDate(offer.validUntil)}</p>
        </section>
      </div>

      <section className="mt-6 overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
            <th className="px-4 py-3">Pos</th><th className="px-4 py-3">Bezeichnung</th><th className="px-4 py-3 text-right">Menge</th><th className="px-4 py-3 text-right">Einzelpreis</th><th className="px-4 py-3 text-right">USt</th><th className="px-4 py-3 text-right">Netto</th>
          </tr></thead>
          <tbody>{offer.lines.map((line) => <tr key={line.id} className="border-b border-gray-100 last:border-0">
            <td className="px-4 py-3 text-gray-500">{line.position}</td><td className="px-4 py-3 font-medium">{line.description}</td><td className="px-4 py-3 text-right tabular-nums">{Number(line.quantity)} {line.unit}</td><td className="px-4 py-3 text-right tabular-nums">{eur.format(Number(line.unitPrice))}</td><td className="px-4 py-3 text-right tabular-nums">{line.taxRate}%</td><td className="px-4 py-3 text-right font-semibold tabular-nums">{eur.format(Number(line.lineNet))}</td>
          </tr>)}</tbody>
          <tfoot>
            <tr className="border-t border-gray-200"><td colSpan={5} className="px-4 py-2 text-right text-gray-500">Netto</td><td className="px-4 py-2 text-right font-semibold tabular-nums">{eur.format(Number(offer.netTotal))}</td></tr>
            <tr><td colSpan={5} className="px-4 py-2 text-right text-gray-500">USt</td><td className="px-4 py-2 text-right font-semibold tabular-nums">{eur.format(Number(offer.taxTotal))}</td></tr>
            <tr className="text-base"><td colSpan={5} className="px-4 py-3 text-right font-semibold">Angebotssumme</td><td className="px-4 py-3 text-right font-bold tabular-nums">{eur.format(Number(offer.grossTotal))}</td></tr>
          </tfoot>
        </table>
      </section>
      {offer.notes && <section className="mt-6 whitespace-pre-line rounded-xl border border-gray-200 bg-white p-5 text-sm text-gray-600 shadow-sm">{offer.notes}</section>}
    </div>
  );
}
