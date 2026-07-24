import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasModule } from "@/lib/permissions";
import { CustomerHandoversTable, type CustomerHandoverRow } from "@/components/customer-handovers-table";
import { CustomerSelect } from "@/components/customer-select";
import type { MovementBillingStatus } from "@/lib/generated/prisma/enums";

export const dynamic = "force-dynamic";
const statuses: { value: MovementBillingStatus | "ALL"; label: string }[] = [
  { value: "PENDING", label: "Ausstehend" }, { value: "INVOICED", label: "Verrechnet" },
  { value: "GIFTED", label: "Verschenkt" }, { value: "ALL", label: "Alle Status" },
];
const sources = [
  { value: "ALL", label: "Alle Übergaben" },
  { value: "WITHOUT_DELIVERY_NOTE", label: "Ohne Lieferschein" },
  { value: "WITH_DELIVERY_NOTE", label: "Mit Lieferschein" },
] as const;
type SourceFilter = (typeof sources)[number]["value"];

export default async function CustomerHandoversPage({ searchParams }: { searchParams: Promise<{ status?: string; kunde?: string; quelle?: string }> }) {
  const { status: rawStatus, kunde, quelle: rawSource } = await searchParams;
  const status = statuses.some((entry) => entry.value === rawStatus) ? rawStatus as MovementBillingStatus | "ALL" : "PENDING";
  const source = sources.some((entry) => entry.value === rawSource) ? rawSource as SourceFilter : "ALL";
  const sourceWhere =
    source === "WITH_DELIVERY_NOTE"
      ? { deliveryNoteLine: { isNot: null } }
      : source === "WITHOUT_DELIVERY_NOTE"
        ? { deliveryNoteLine: { is: null } }
        : {};
  const session = await auth();
  const canCreateInvoice = Boolean(session?.user && hasModule(session.user, "INVOICES"));
  const [movements, customers, counts] = await Promise.all([
    prisma.movement.findMany({
      where: {
        type: "OUT",
        customerId: kunde || { not: null },
        billingStatus: status === "ALL" ? { not: null } : status,
        ...sourceWhere,
      },
      orderBy: { createdAt: "desc" }, take: 500,
      include: {
        customer: { select: { id: true, name: true, customerNumber: true } }, item: { select: { name: true, sku: true } },
        warehouse: { select: { name: true } }, invoiceLine: { select: { invoice: { select: { id: true, number: true, status: true } } } },
        deliveryNoteLine: { select: { deliveryNote: { select: { id: true, number: true } } } },
      },
    }),
    prisma.customer.findMany({ where: { movements: { some: { billingStatus: { not: null } } } }, orderBy: { name: "asc" }, select: { id: true, name: true, customerNumber: true } }),
    prisma.movement.groupBy({ by: ["billingStatus"], where: { type: "OUT", customerId: { not: null }, billingStatus: { not: null } }, _count: { _all: true } }),
  ]);
  const countFor = (value: MovementBillingStatus) => counts.find((entry) => entry.billingStatus === value)?._count._all ?? 0;
  const rows: CustomerHandoverRow[] = movements.flatMap((movement) => movement.customer && movement.billingStatus ? [{
    id: movement.id, createdAt: movement.createdAt.toISOString(), quantity: movement.quantity,
    billingStatus: movement.billingStatus, note: movement.note, customer: movement.customer,
    item: movement.item, warehouse: movement.warehouse, invoice: movement.invoiceLine?.invoice ?? null,
    deliveryNote: movement.deliveryNoteLine?.deliveryNote ?? null,
  }] : []);
  return <div className="mx-auto max-w-7xl">
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div><h1 className="text-2xl font-semibold">Kundenübergaben</h1><p className="text-sm text-gray-500">{countFor("PENDING")} ausstehend · {countFor("INVOICED")} verrechnet · {countFor("GIFTED")} verschenkt</p></div>
      <form method="GET" className="flex flex-wrap gap-2">
        <CustomerSelect customers={customers} name="kunde" defaultValue={kunde ?? ""} emptyLabel="Alle Kunden" className="w-64" />
        <select name="status" defaultValue={status} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm">{statuses.map((entry) => <option key={entry.value} value={entry.value}>{entry.label}</option>)}</select>
        <select name="quelle" defaultValue={source} aria-label="Lieferscheinfilter" className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm">{sources.map((entry) => <option key={entry.value} value={entry.value}>{entry.label}</option>)}</select>
        <button type="submit" className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700">Filtern</button>
      </form>
    </div>
    <CustomerHandoversTable rows={rows} canCreateInvoice={canCreateInvoice} />
  </div>;
}
