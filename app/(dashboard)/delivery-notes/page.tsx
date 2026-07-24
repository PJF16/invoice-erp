import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/format";
import { CustomerSelect } from "@/components/customer-select";
import { auth } from "@/lib/auth";
import { hasModule } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function DeliveryNotesPage({ searchParams }: { searchParams: Promise<{ kunde?: string }> }) {
  const { kunde } = await searchParams;
  const [notes, customers, session] = await Promise.all([
    prisma.deliveryNote.findMany({
      where: { customerId: kunde || undefined },
      orderBy: { createdAt: "desc" },
      take: 300,
      include: {
        _count: { select: { lines: true } },
        createdBy: { select: { name: true } },
        lines: { select: { movement: { select: { billingStatus: true } } } },
      },
    }),
    prisma.customer.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, customerNumber: true } }),
    auth(),
  ]);
  const canCreateInvoice = Boolean(session?.user && hasModule(session.user, "INVOICES"));
  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div><h1 className="text-2xl font-semibold">Lieferscheine</h1><p className="text-sm text-gray-500">{notes.length} Lieferscheine im aktuellen Filter</p></div>
        <div className="flex flex-wrap gap-2">
          <form method="GET" className="flex gap-2">
            <CustomerSelect customers={customers} name="kunde" defaultValue={kunde ?? ""} emptyLabel="Alle Kunden" className="w-64" />
            <button type="submit" className="rounded-lg border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50">Filtern</button>
          </form>
          <Link href="/delivery-notes/new" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">+ Neuer Lieferschein</Link>
        </div>
      </div>
      <form action="/invoices/new" method="GET">
        {canCreateInvoice && (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
            <p className="text-sm text-blue-800">Einzelnen Lieferschein direkt übernehmen oder mehrere offene Lieferscheine desselben Kunden auswählen.</p>
            <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">Ausgewählte übernehmen</button>
          </div>
        )}
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">{canCreateInvoice && <th className="w-10 px-3 py-3"><span className="sr-only">Auswahl</span></th>}<th className="px-4 py-3">Nummer</th><th className="px-4 py-3">Kunde</th><th className="px-4 py-3">Lieferdatum</th><th className="px-4 py-3 text-right">Positionen</th><th className="px-4 py-3">Verrechnung</th><th className="px-4 py-3">Erstellt von</th>{canCreateInvoice && <th className="px-4 py-3 text-right">Aktion</th>}</tr></thead>
            <tbody>
              {notes.length === 0 && <tr><td colSpan={canCreateInvoice ? 8 : 6} className="px-4 py-10 text-center text-gray-500">Keine Lieferscheine gefunden.</td></tr>}
              {notes.map((note) => {
                const pendingCount = note.lines.filter((line) => line.movement.billingStatus === "PENDING").length;
                return <tr key={note.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">{canCreateInvoice && <td className="px-3 py-3 text-center">{pendingCount > 0 && <input type="checkbox" name="lieferscheine" value={note.id} aria-label={`Lieferschein ${note.number} auswählen`} className="h-4 w-4 rounded border-gray-300" />}</td>}<td className="px-4 py-3 font-medium"><Link href={`/delivery-notes/${note.id}`} className="text-blue-700 hover:underline">{note.number}</Link></td><td className="px-4 py-3">{note.customerName}</td><td className="px-4 py-3 text-gray-500">{formatDate(note.issueDate)}</td><td className="px-4 py-3 text-right tabular-nums">{note._count.lines}</td><td className="px-4 py-3">{pendingCount === 0 ? <span className="text-green-700">Erledigt</span> : pendingCount === note._count.lines ? <span className="text-amber-700">Ausstehend</span> : <span className="text-amber-700">{pendingCount} offen</span>}</td><td className="px-4 py-3 text-gray-500">{note.createdBy.name}</td>{canCreateInvoice && <td className="px-4 py-3 text-right">{pendingCount > 0 ? <Link href={`/invoices/new?lieferscheine=${note.id}`} className="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100">In Rechnung übernehmen</Link> : <span className="text-xs text-gray-400">–</span>}</td>}</tr>;
              })}
            </tbody>
          </table>
        </div>
      </form>
    </div>
  );
}
