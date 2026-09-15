import { BankReconciliation } from "@/components/bank-reconciliation";
import { getReconciliationData } from "@/lib/bank-reconciliation";

export const dynamic = "force-dynamic";

export default async function BankReconciliationPage() {
  const data = await getReconciliationData();
  return (
    <div className="mx-auto max-w-[100rem]">
      <h1 className="mb-1 text-2xl font-semibold">Bankabgleich</h1>
      <p className="mb-6 text-sm text-gray-500">
        ELBA-Umsätze importieren und Zahlungseingänge offenen Rechnungen zuordnen.
      </p>
      <BankReconciliation initialData={data} />
    </div>
  );
}
