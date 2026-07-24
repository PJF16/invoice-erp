import { prisma } from "@/lib/prisma";
import { CustomerForm, CustomerRowActions } from "@/components/customer-form";
import { TAX_TREATMENT_LABELS } from "@/lib/invoices";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const customers = await prisma.customer.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { invoices: true } } },
  });

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Kunden</h1>
          <p className="text-sm text-gray-500">{customers.length} Kunden</p>
        </div>
        <CustomerForm />
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
              <th className="px-4 py-3">Kd.-Nr.</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Ort</th>
              <th className="px-4 py-3">UID</th>
              <th className="px-4 py-3">Steuer</th>
              <th className="px-4 py-3">Zahlungsziel</th>
              <th className="px-4 py-3">E-Mail</th>
              <th className="px-4 py-3 text-right">Rechnungen</th>
              <th className="px-4 py-3 text-right">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {customers.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                  Noch keine Kunden angelegt.
                </td>
              </tr>
            )}
            {customers.map((c) => (
              <tr key={c.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-xs text-gray-500">{c.customerNumber ?? "–"}</td>
                <td className="px-4 py-3 font-medium">{c.name}</td>
                <td className="px-4 py-3 text-gray-500">
                  {[c.zip, c.city].filter(Boolean).join(" ")}
                  {c.country !== "Österreich" && c.country ? ` (${c.country})` : ""}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-gray-500">{c.uid ?? "–"}</td>
                <td className="px-4 py-3 text-xs text-gray-500">
                  {TAX_TREATMENT_LABELS[c.defaultTaxTreatment]}
                </td>
                <td className="px-4 py-3 text-gray-500">
                  {c.paymentDays == null ? "Standard" : `${c.paymentDays} Tage`}
                </td>
                <td className="px-4 py-3 text-gray-500">{c.email ?? "–"}</td>
                <td className="px-4 py-3 text-right tabular-nums">{c._count.invoices}</td>
                <td className="px-4 py-3 text-right">
                  <CustomerRowActions
                    customer={{
                      id: c.id,
                      customerNumber: c.customerNumber,
                      name: c.name,
                      contactPerson: c.contactPerson,
                      email: c.email,
                      street: c.street,
                      zip: c.zip,
                      city: c.city,
                      country: c.country,
                      uid: c.uid,
                      defaultTaxTreatment: c.defaultTaxTreatment,
                      paymentDays: c.paymentDays,
                      notes: c.notes,
                    }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
