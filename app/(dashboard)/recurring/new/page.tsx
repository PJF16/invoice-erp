import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { RecurringForm } from "@/components/recurring-form";

export const dynamic = "force-dynamic";

export default async function NewRecurringPage() {
  const [customers, softwareItems] = await Promise.all([
    prisma.customer.findMany({ orderBy: { name: "asc" } }),
    prisma.softwareItem.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/recurring" className="text-sm text-gray-500 hover:text-gray-900">
        ← Zurück zu den Vorlagen
      </Link>
      <h1 className="mt-2 mb-6 text-2xl font-semibold">Neue wiederkehrende Rechnung</h1>
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
      />
    </div>
  );
}
