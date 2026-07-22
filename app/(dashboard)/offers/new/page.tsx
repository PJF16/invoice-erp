import Link from "next/link";
import { OfferForm } from "@/components/offer-form";
import { loadInvoiceFormData } from "@/lib/invoice-form-data";
import { toDateInput } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function NewOfferPage() {
  const data = await loadInvoiceFormData();
  const issueDate = new Date();
  const validUntil = new Date(issueDate);
  validUntil.setDate(validUntil.getDate() + 30);
  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/offers" className="text-sm text-gray-500 hover:text-gray-900">← Zurück zu den Angeboten</Link>
      <h1 className="mt-2 mb-6 text-2xl font-semibold">Neues Angebot</h1>
      <OfferForm
        data={data}
        initial={{
          customerId: "",
          issueDate: toDateInput(issueDate),
          validUntil: toDateInput(validUntil),
          taxTreatment: "STANDARD",
          notes: null,
          lines: [],
        }}
      />
    </div>
  );
}
