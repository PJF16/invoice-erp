import Link from "next/link";
import { loadInvoiceFormData } from "@/lib/invoice-form-data";
import { InvoiceForm, type InvoiceInitial } from "@/components/invoice-form";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { toDateInput } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function NewInvoicePage({
  searchParams,
}: {
  searchParams: Promise<{ bewegungen?: string }>;
}) {
  const { bewegungen } = await searchParams;
  const movementIds = [...new Set((bewegungen ?? "").split(",").filter(Boolean))].slice(0, 100);
  const [data, movements, settings] = await Promise.all([
    loadInvoiceFormData(),
    movementIds.length > 0
      ? prisma.movement.findMany({
          where: { id: { in: movementIds } },
          include: { item: true, customer: true },
        })
      : [],
    getSettings(),
  ]);
  const firstCustomer = movements[0]?.customer;
  const validMovements =
    movementIds.length > 0 &&
    movements.length === movementIds.length &&
    Boolean(firstCustomer) &&
    movements.every(
      (movement) =>
        movement.type === "OUT" &&
        movement.billingStatus === "PENDING" &&
        movement.customerId === firstCustomer?.id,
    );
  const issueDate = new Date();
  const dueDate = new Date(issueDate);
  dueDate.setDate(dueDate.getDate() + settings.paymentDays);
  const initial: InvoiceInitial | undefined = validMovements
    ? {
        customerId: firstCustomer!.id,
        issueDate: toDateInput(issueDate),
        dueDate: toDateInput(dueDate),
        servicePeriodStart: null,
        servicePeriodEnd: null,
        taxTreatment: firstCustomer!.defaultTaxTreatment,
        notes: null,
        lines: movementIds.map((id) => {
          const movement = movements.find((entry) => entry.id === id)!;
          return {
            description: movement.item.name,
            quantity: Math.abs(movement.quantity),
            unit: "Stk",
            unitPrice: 0,
            taxRate: 20,
            softwareItemId: "",
            itemId: movement.itemId,
            warehouseId: movement.warehouseId,
            sourceMovementId: movement.id,
          };
        }),
      }
    : undefined;

  return (
    <div className="mx-auto max-w-4xl">
      <Link href={initial ? "/customer-handovers" : "/invoices"} className="text-sm text-gray-500 hover:text-gray-900">
        ← Zurück {initial ? "zu den Kundenübergaben" : "zu den Rechnungen"}
      </Link>
      <h1 className="mt-2 mb-6 text-2xl font-semibold">{initial ? "Rechnung aus Kundenübergaben" : "Neue Rechnung"}</h1>
      {movementIds.length > 0 && !initial && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Die ausgewählten Übergaben sind nicht mehr offen oder gehören nicht zum selben Kunden.
        </p>
      )}
      <InvoiceForm data={data} initial={initial} defaultDueDate={toDateInput(dueDate)} />
    </div>
  );
}
