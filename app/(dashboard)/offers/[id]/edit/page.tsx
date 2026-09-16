import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { loadInvoiceFormData } from "@/lib/invoice-form-data";
import { OfferForm } from "@/components/offer-form";
import { toDateInput } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function EditOfferPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [offer, data] = await Promise.all([
    prisma.offer.findUnique({ where: { id }, include: { lines: { orderBy: { position: "asc" } } } }),
    loadInvoiceFormData(),
  ]);
  if (!offer) notFound();
  return (
    <div className="mx-auto max-w-4xl">
      <Link href={`/offers/${id}`} className="text-sm text-gray-500 hover:text-gray-900">← Zurück zum Angebot</Link>
      <h1 className="mt-2 mb-6 text-2xl font-semibold">Angebot bearbeiten</h1>
      {offer.status === "CONVERTED" && (
        <p className="mb-6 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Änderungen an diesem Angebot wirken sich nicht auf die bereits daraus erstellte Rechnung aus.
        </p>
      )}
      <OfferForm
        data={data}
        initial={{
          id: offer.id,
          number: offer.number,
          status: offer.status,
          customerId: offer.customerId,
          issueDate: toDateInput(offer.issueDate),
          validUntil: toDateInput(offer.validUntil),
          deliveryDate: offer.deliveryDate ? toDateInput(offer.deliveryDate) : null,
          servicePeriodStart: offer.servicePeriodStart ? toDateInput(offer.servicePeriodStart) : null,
          servicePeriodEnd: offer.servicePeriodEnd ? toDateInput(offer.servicePeriodEnd) : null,
          taxTreatment: offer.taxTreatment,
          notes: offer.notes,
          lines: offer.lines.map((line) => ({
            description: line.description,
            quantity: Number(line.quantity),
            unit: line.unit,
            unitPrice: Number(line.unitPrice),
            taxRate: line.taxRate,
            supplyKind: line.supplyKind,
            softwareItemId: line.softwareItemId ?? "",
            itemId: line.itemId ?? "",
            warehouseId: line.warehouseId ?? "",
          })),
        }}
      />
    </div>
  );
}
