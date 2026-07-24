import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { toDateInput } from "@/lib/format";
import { DeliveryNoteForm } from "@/components/delivery-note-form";

export const dynamic = "force-dynamic";

export default async function NewDeliveryNotePage() {
  const [customers, items, warehouses] = await Promise.all([
    prisma.customer.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, customerNumber: true } }),
    prisma.item.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, sku: true, stocks: { select: { warehouseId: true, quantity: true } } } }),
    prisma.warehouse.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/delivery-notes" className="text-sm text-gray-500 hover:text-gray-900">← Zurück zu den Lieferscheinen</Link>
      <h1 className="mt-2 mb-6 text-2xl font-semibold">Neuer Lieferschein</h1>
      <DeliveryNoteForm customers={customers} items={items} warehouses={warehouses} defaultIssueDate={toDateInput(new Date())} />
    </div>
  );
}
