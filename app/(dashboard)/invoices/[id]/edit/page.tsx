import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { toDateInput } from "@/lib/format";
import { loadInvoiceFormData } from "@/lib/invoice-form-data";
import { InvoiceForm } from "@/components/invoice-form";

export const dynamic = "force-dynamic";

export default async function EditInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [invoice, data] = await Promise.all([
    prisma.invoice.findUnique({
      where: { id },
      include: { lines: { orderBy: { position: "asc" } } },
    }),
    loadInvoiceFormData(),
  ]);
  if (!invoice) notFound();
  if (invoice.status !== "DRAFT") redirect(`/invoices/${id}`);

  return (
    <div className="mx-auto max-w-4xl">
      <Link href={`/invoices/${id}`} className="text-sm text-gray-500 hover:text-gray-900">
        ← Zurück zur Rechnung
      </Link>
      <h1 className="mt-2 mb-6 text-2xl font-semibold">Entwurf bearbeiten</h1>
      <InvoiceForm
        data={data}
        initial={{
          id: invoice.id,
          customerId: invoice.customerId,
          issueDate: toDateInput(invoice.issueDate),
          dueDate: toDateInput(invoice.dueDate),
          servicePeriodStart: invoice.servicePeriodStart ? toDateInput(invoice.servicePeriodStart) : null,
          servicePeriodEnd: invoice.servicePeriodEnd ? toDateInput(invoice.servicePeriodEnd) : null,
          taxTreatment: invoice.taxTreatment,
          notes: invoice.notes,
          lines: invoice.lines.map((l) => ({
            description: l.description,
            quantity: Number(l.quantity),
            unit: l.unit,
            unitPrice: Number(l.unitPrice),
            taxRate: l.taxRate,
            softwareItemId: l.softwareItemId ?? "",
            itemId: l.itemId ?? "",
            warehouseId: l.warehouseId ?? "",
          })),
        }}
      />
    </div>
  );
}
