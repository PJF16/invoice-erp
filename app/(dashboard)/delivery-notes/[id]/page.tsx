import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/format";
import { auth } from "@/lib/auth";
import { hasModule } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function DeliveryNoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [note, session] = await Promise.all([
    prisma.deliveryNote.findUnique({
      where: { id },
      include: {
        createdBy: { select: { name: true } },
        lines: { orderBy: { position: "asc" }, include: { movement: { include: { invoiceLine: { include: { invoice: { select: { id: true, number: true } } } } } } } },
      },
    }),
    auth(),
  ]);
  if (!note) notFound();
  const pendingCount = note.lines.filter((line) => line.movement.billingStatus === "PENDING").length;
  const canCreateInvoice = Boolean(session?.user && hasModule(session.user, "INVOICES"));
  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/delivery-notes" className="text-sm text-gray-500 hover:text-gray-900">← Zurück zu den Lieferscheinen</Link>
      <div className="mt-2 mb-6 flex flex-wrap items-start justify-between gap-4">
        <div><h1 className="text-2xl font-semibold">Lieferschein {note.number}</h1><p className="mt-1 text-sm text-gray-500">{note.customerName} · {formatDate(note.issueDate)} · erstellt von {note.createdBy.name}</p></div>
        <div className="flex flex-wrap gap-2">
          {canCreateInvoice && pendingCount > 0 && <Link href={`/invoices/new?lieferscheine=${note.id}`} className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700">{pendingCount === note.lines.length ? "In Rechnung übernehmen" : `${pendingCount} offene Position${pendingCount === 1 ? "" : "en"} übernehmen`}</Link>}
          <a href={`/api/delivery-notes/${note.id}/pdf`} target="_blank" className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium hover:bg-gray-50">PDF öffnen</a>
        </div>
      </div>
      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"><h2 className="mb-2 text-sm font-semibold">Empfänger</h2><p className="text-sm font-medium">{note.customerName}</p><p className="whitespace-pre-line text-sm text-gray-500">{note.customerAddress}</p>{note.customerUid && <p className="mt-1 text-sm text-gray-500">UID: {note.customerUid}</p>}</section>
      <section className="mt-6 overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-sm"><thead><tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500"><th className="px-4 py-3">Pos</th><th className="px-4 py-3">SKU</th><th className="px-4 py-3">Artikel</th><th className="px-4 py-3">Lager</th><th className="px-4 py-3 text-right">Menge</th><th className="px-4 py-3">Verrechnung</th></tr></thead>
          <tbody>{note.lines.map((line) => <tr key={line.id} className="border-b border-gray-100 last:border-0"><td className="px-4 py-3 text-gray-500">{line.position}</td><td className="px-4 py-3 font-mono text-xs text-gray-500">{line.itemSku ?? "–"}</td><td className="px-4 py-3 font-medium">{line.itemName}</td><td className="px-4 py-3 text-gray-500">{line.warehouseName}</td><td className="px-4 py-3 text-right font-semibold tabular-nums">{line.quantity}</td><td className="px-4 py-3">{line.movement.invoiceLine ? <Link href={`/invoices/${line.movement.invoiceLine.invoice.id}`} className="text-blue-700 hover:underline">{line.movement.invoiceLine.invoice.number ?? "Rechnungsentwurf"}</Link> : <span className="text-amber-700">Ausstehend</span>}</td></tr>)}</tbody>
        </table>
      </section>
      {note.notes && <section className="mt-6 whitespace-pre-line rounded-xl border border-gray-200 bg-white p-5 text-sm text-gray-600 shadow-sm">{note.notes}</section>}
    </div>
  );
}
