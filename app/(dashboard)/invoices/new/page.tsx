import Link from "next/link";
import { loadInvoiceFormData } from "@/lib/invoice-form-data";
import { InvoiceForm } from "@/components/invoice-form";

export const dynamic = "force-dynamic";

export default async function NewInvoicePage() {
  const data = await loadInvoiceFormData();

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/invoices" className="text-sm text-gray-500 hover:text-gray-900">
        ← Zurück zu den Rechnungen
      </Link>
      <h1 className="mt-2 mb-6 text-2xl font-semibold">Neue Rechnung</h1>
      <InvoiceForm data={data} />
    </div>
  );
}
