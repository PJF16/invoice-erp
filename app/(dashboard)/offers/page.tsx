import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { eur, formatDate, OFFER_STATUS_LABELS } from "@/lib/format";
import type { OfferStatus } from "@/lib/generated/prisma/enums";

export const dynamic = "force-dynamic";

const statuses: { value: OfferStatus | "ALL"; label: string }[] = [
  { value: "ALL", label: "Alle Status" },
  { value: "DRAFT", label: "Entwürfe" },
  { value: "OPEN", label: "Offen" },
  { value: "ACCEPTED", label: "Angenommen" },
  { value: "REJECTED", label: "Abgelehnt" },
  { value: "CONVERTED", label: "In Rechnung" },
];

export default async function OffersPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status: rawStatus } = await searchParams;
  const status = statuses.some((entry) => entry.value === rawStatus) ? rawStatus as OfferStatus | "ALL" : "ALL";
  const offers = await prisma.offer.findMany({
    where: status === "ALL" ? undefined : { status },
    orderBy: { createdAt: "desc" },
    take: 300,
    include: { customer: { select: { name: true } } },
  });
  const now = new Date();
  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Angebote</h1>
          <p className="text-sm text-gray-500">{offers.length} Angebote im aktuellen Filter</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <form method="GET">
            <select name="status" defaultValue={status} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm">
              {statuses.map((entry) => <option key={entry.value} value={entry.value}>{entry.label}</option>)}
            </select>
            <button type="submit" className="ml-2 rounded-lg border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50">Filtern</button>
          </form>
          <Link href="/offers/new" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">+ Neues Angebot</Link>
        </div>
      </div>
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
            <th className="px-4 py-3">Nummer</th><th className="px-4 py-3">Kunde</th><th className="px-4 py-3">Datum</th><th className="px-4 py-3">Gültig bis</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Summe</th>
          </tr></thead>
          <tbody>
            {offers.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-500">Keine Angebote gefunden.</td></tr>}
            {offers.map((offer) => {
              const badge = OFFER_STATUS_LABELS[offer.status];
              const expired = offer.status === "OPEN" && offer.validUntil < now;
              return <tr key={offer.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                <td className="px-4 py-3 font-medium"><Link href={`/offers/${offer.id}`} className="text-blue-700 hover:underline">{offer.number ?? "Entwurf"}</Link></td>
                <td className="px-4 py-3">{offer.customerName || offer.customer.name}</td>
                <td className="px-4 py-3 text-gray-500">{formatDate(offer.issueDate)}</td>
                <td className={`px-4 py-3 ${expired ? "font-medium text-red-600" : "text-gray-500"}`}>{formatDate(offer.validUntil)}{expired ? " · abgelaufen" : ""}</td>
                <td className="px-4 py-3"><span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${badge.className}`}>{badge.label}</span></td>
                <td className="px-4 py-3 text-right font-semibold tabular-nums">{eur.format(Number(offer.grossTotal))}</td>
              </tr>;
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
