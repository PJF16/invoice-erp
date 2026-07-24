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
  searchParams: Promise<{ bewegungen?: string; lieferscheine?: string | string[] }>;
}) {
  const { bewegungen, lieferscheine } = await searchParams;
  const movementIds = [...new Set((bewegungen ?? "").split(",").filter(Boolean))].slice(0, 100);
  const deliveryNoteIds = [
    ...new Set(
      (Array.isArray(lieferscheine) ? lieferscheine : [lieferscheine ?? ""])
        .flatMap((value) => value.split(","))
        .filter(Boolean),
    ),
  ].slice(0, 50);
  const hasMovementRequest = movementIds.length > 0;
  const hasDeliveryNoteRequest = deliveryNoteIds.length > 0;
  const [data, movements, deliveryNotes, settings] = await Promise.all([
    loadInvoiceFormData(),
    hasMovementRequest
      ? prisma.movement.findMany({
          where: { id: { in: movementIds } },
          include: { item: true, customer: true },
        })
      : [],
    hasDeliveryNoteRequest
      ? prisma.deliveryNote.findMany({
          where: { id: { in: deliveryNoteIds } },
          include: {
            customer: true,
            lines: {
              orderBy: { position: "asc" },
              include: { movement: true },
            },
          },
        })
      : [],
    getSettings(),
  ]);
  const orderedDeliveryNotes = deliveryNoteIds
    .map((id) => deliveryNotes.find((note) => note.id === id))
    .filter((note): note is NonNullable<typeof note> => Boolean(note));
  const pendingDeliveryLines = orderedDeliveryNotes.flatMap((note) =>
    note.lines
      .filter((line) => line.movement.billingStatus === "PENDING")
      .map((line) => ({ note, line })),
  );
  const directCustomer = movements[0]?.customer;
  const deliveryCustomer = orderedDeliveryNotes[0]?.customer;
  const validMovements =
    hasMovementRequest &&
    !hasDeliveryNoteRequest &&
    movements.length === movementIds.length &&
    Boolean(directCustomer) &&
    movements.every(
      (movement) =>
        movement.type === "OUT" &&
        movement.billingStatus === "PENDING" &&
        movement.customerId === directCustomer?.id,
    );
  const validDeliveryNotes =
    hasDeliveryNoteRequest &&
    !hasMovementRequest &&
    orderedDeliveryNotes.length === deliveryNoteIds.length &&
    Boolean(deliveryCustomer) &&
    pendingDeliveryLines.length > 0 &&
    orderedDeliveryNotes.every((note) => note.customerId === deliveryCustomer?.id) &&
    pendingDeliveryLines.every(
      ({ note, line }) =>
        line.movement.type === "OUT" &&
        line.movement.customerId === note.customerId &&
        line.movement.billingStatus === "PENDING",
    );
  const customer = validDeliveryNotes ? deliveryCustomer : validMovements ? directCustomer : null;
  const issueDate = new Date();
  const dueDate = new Date(issueDate);
  const paymentDays = customer?.paymentDays ?? settings.paymentDays;
  dueDate.setDate(dueDate.getDate() + paymentDays);
  const initial: InvoiceInitial | undefined = customer
    ? {
        customerId: customer.id,
        issueDate: toDateInput(issueDate),
        dueDate: toDateInput(dueDate),
        servicePeriodStart: null,
        servicePeriodEnd: null,
        taxTreatment: customer.defaultTaxTreatment,
        notes: validDeliveryNotes
          ? `Lieferschein${orderedDeliveryNotes.length === 1 ? "" : "e"}: ${orderedDeliveryNotes.map((note) => note.number).join(", ")}`
          : null,
        lines: validDeliveryNotes
          ? pendingDeliveryLines.map(({ line }) => ({
              description: line.itemName,
              quantity: line.quantity,
              unit: "Stk",
              unitPrice: 0,
              taxRate: 20,
              softwareItemId: "",
              itemId: line.itemId,
              warehouseId: line.warehouseId,
              sourceMovementId: line.movementId,
            }))
          : movementIds.map((id) => {
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
  const isSourceRequest = hasMovementRequest || hasDeliveryNoteRequest;
  const sourceLabel = validDeliveryNotes ? "Lieferscheinen" : "Kundenübergaben";
  const backHref = hasDeliveryNoteRequest
    ? deliveryNoteIds.length === 1
      ? `/delivery-notes/${deliveryNoteIds[0]}`
      : "/delivery-notes"
    : initial
      ? "/customer-handovers"
      : "/invoices";
  const skippedDeliveryLines = orderedDeliveryNotes.reduce((sum, note) => sum + note.lines.length, 0) - pendingDeliveryLines.length;

  return (
    <div className="mx-auto max-w-4xl">
      <Link href={backHref} className="text-sm text-gray-500 hover:text-gray-900">
        ← Zurück {hasDeliveryNoteRequest ? "zu den Lieferscheinen" : initial ? "zu den Kundenübergaben" : "zu den Rechnungen"}
      </Link>
      <h1 className="mt-2 mb-6 text-2xl font-semibold">{initial ? `Rechnung aus ${sourceLabel}` : "Neue Rechnung"}</h1>
      {isSourceRequest && !initial && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Die ausgewählten Positionen sind nicht mehr offen, wurden nicht gefunden oder gehören nicht zum selben Kunden.
        </p>
      )}
      {validDeliveryNotes && skippedDeliveryLines > 0 && (
        <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {skippedDeliveryLines} bereits verrechnete oder erledigte Position{skippedDeliveryLines === 1 ? "" : "en"} wurden nicht erneut übernommen.
        </p>
      )}
      {(!isSourceRequest || initial) && (
        <InvoiceForm
          data={data}
          initial={initial}
          defaultDueDate={toDateInput(dueDate)}
          defaultPaymentDays={settings.paymentDays}
        />
      )}
    </div>
  );
}
