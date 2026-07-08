import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { toDateInput } from "@/lib/format";
import { RecurringForm } from "@/components/recurring-form";

export const dynamic = "force-dynamic";

export default async function EditRecurringPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [template, customers, softwareItems] = await Promise.all([
    prisma.recurringInvoice.findUnique({
      where: { id },
      include: { lines: { orderBy: { position: "asc" } } },
    }),
    prisma.customer.findMany({ orderBy: { name: "asc" } }),
    prisma.softwareItem.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);
  if (!template) notFound();

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/recurring" className="text-sm text-gray-500 hover:text-gray-900">
        ← Zurück zu den Vorlagen
      </Link>
      <h1 className="mt-2 mb-6 text-2xl font-semibold">Vorlage bearbeiten</h1>
      <RecurringForm
        data={{
          customers: customers.map((c) => ({
            id: c.id,
            name: c.name,
            defaultTaxTreatment: c.defaultTaxTreatment,
            email: c.email,
          })),
          softwareItems: softwareItems.map((s) => ({
            id: s.id,
            name: s.name,
            unitPrice: Number(s.unitPrice),
            unit: s.unit,
          })),
        }}
        initial={{
          id: template.id,
          name: template.name,
          customerId: template.customerId,
          interval: template.interval,
          nextRun: toDateInput(template.nextRun),
          active: template.active,
          autoSend: template.autoSend,
          taxTreatment: template.taxTreatment,
          notes: template.notes,
          lines: template.lines.map((l) => ({
            softwareItemId: l.softwareItemId ?? "",
            description: l.description ?? "",
            unitPrice: Number(l.unitPrice ?? 0),
            quantity: Number(l.quantity),
            unit: l.unit,
            taxRate: l.taxRate,
          })),
        }}
      />
    </div>
  );
}
