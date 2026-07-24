import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/format";
import { CustomerSelect } from "@/components/customer-select";

export const dynamic = "force-dynamic";

export default async function DeliveryNotesPage({ searchParams }: { searchParams: Promise<{ kunde?: string }> }) {
  const { kunde } = await searchParams;
  const [notes, customers] = await Promise.all([
    prisma.deliveryNote.findMany({
      where: { customerId: kunde || undefined },
      orderBy: { createdAt: "desc" },
      take: 300,
      include: { _count: { select: { lines: true } }, createdBy: { select: { name: true } } },
    }),
    prisma.customer.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, customerNumber: true } }),
  ]);
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
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500"><th className="px-4 py-3">Nummer</th><th className="px-4 py-3">Kunde</th><th className="px-4 py-3">Lieferdatum</th><th className="px-4 py-3 text-right">Positionen</th><th className="px-4 py-3">Erstellt von</th></tr></thead>
          <tbody>
            {notes.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-gray-500">Keine Lieferscheine gefunden.</td></tr>}
            {notes.map((note) => <tr key={note.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50"><td className="px-4 py-3 font-medium"><Link href={`/delivery-notes/${note.id}`} className="text-blue-700 hover:underline">{note.number}</Link></td><td className="px-4 py-3">{note.customerName}</td><td className="px-4 py-3 text-gray-500">{formatDate(note.issueDate)}</td><td className="px-4 py-3 text-right tabular-nums">{note._count.lines}</td><td className="px-4 py-3 text-gray-500">{note.createdBy.name}</td></tr>)}
          </tbody>
        </table>
      </div>
    </div>
  );
}
