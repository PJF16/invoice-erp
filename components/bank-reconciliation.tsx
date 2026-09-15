"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { eur, formatDate } from "@/lib/format";

type Suggestion = {
  invoiceId: string;
  invoiceNumber: string;
  customerName: string;
  openAmount: number;
  score: number;
  confidence: "AUTO" | "SUGGESTION";
  reasons: string[];
  grantSkonto: boolean;
};

type Transaction = {
  id: string;
  bookingDate: string;
  amount: number;
  currency: string;
  description: string;
  counterpartyName: string | null;
  counterpartyIban: string | null;
  paymentReference: string | null;
  ignoredAt: string | null;
  payment: { id: string; invoiceId: string; invoiceNumber: string | null; customerName: string } | null;
  suggestions: Suggestion[];
};

type Props = {
  initialData: {
    invoices: { id: string; number: string; customerName: string; openAmount: number }[];
    transactions: Transaction[];
  };
};

type ImportResult = {
  parsedRows: number;
  incomingRows: number;
  importedRows: number;
  duplicateRows: number;
  automaticMatches: number;
  unresolved: number;
};

export function BankReconciliation({ initialData }: Props) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [selections, setSelections] = useState<Record<string, string>>(() =>
    Object.fromEntries(initialData.transactions.map((row) => [row.id, row.suggestions[0]?.invoiceId ?? ""])),
  );

  const unresolved = useMemo(
    () => initialData.transactions.filter((row) => !row.payment && !row.ignoredAt),
    [initialData.transactions],
  );
  const completed = useMemo(
    () => initialData.transactions.filter((row) => row.payment || row.ignoredAt).slice(0, 30),
    [initialData.transactions],
  );

  async function upload(event: React.FormEvent) {
    event.preventDefault();
    if (!file) return;
    setUploading(true);
    setError(null);
    setResult(null);
    const body = new FormData();
    body.set("file", file);
    const response = await fetch("/api/bank-reconciliation/import", { method: "POST", body });
    const data = await response.json().catch(() => null);
    setUploading(false);
    if (!response.ok) {
      setError(data?.error ?? "CSV konnte nicht importiert werden");
      return;
    }
    setResult(data);
    setFile(null);
    const input = document.getElementById("elba-csv") as HTMLInputElement | null;
    if (input) input.value = "";
    router.refresh();
  }

  async function act(id: string, action: "MATCH" | "IGNORE" | "REOPEN", grantSkonto = false) {
    const transaction = initialData.transactions.find((row) => row.id === id);
    const invoiceId = selections[id] ?? transaction?.suggestions[0]?.invoiceId ?? "";
    if (action === "MATCH" && !invoiceId) {
      setError("Bitte zuerst eine Rechnung auswählen");
      return;
    }
    if (action === "IGNORE" && !confirm("Diesen Zahlungseingang aus der offenen Liste ausblenden?")) return;
    setBusyId(id);
    setError(null);
    const response = await fetch(`/api/bank-reconciliation/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(action === "MATCH" ? { action, invoiceId, grantSkonto } : { action }),
    });
    const data = await response.json().catch(() => null);
    setBusyId(null);
    if (!response.ok) {
      setError(data?.error ?? "Aktion konnte nicht ausgeführt werden");
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold">ELBA-CSV importieren</h2>
        <p className="mt-1 text-xs text-gray-500">
          Es werden ausschließlich positive Zahlungseingänge übernommen. Bereits importierte Buchungen erkennt das System automatisch.
        </p>
        <form onSubmit={upload} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            id="elba-csv"
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-gray-100 file:px-3 file:py-1 file:text-sm"
          />
          <button
            type="submit"
            disabled={!file || uploading}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {uploading ? "Wird abgeglichen …" : "Importieren und abgleichen"}
          </button>
        </form>
        {error && <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {result && (
          <p className="mt-3 rounded-lg bg-green-50 p-3 text-sm text-green-800">
            {result.incomingRows} Zahlungseingänge gefunden, {result.importedRows} neu importiert, {result.duplicateRows} bereits vorhanden.
            {result.automaticMatches > 0 && ` ${result.automaticMatches} eindeutig zugeordnet.`}
            {result.unresolved > 0 && ` ${result.unresolved} benötigen eine Prüfung.`}
          </p>
        )}
      </section>

      <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-5 py-4">
          <h2 className="text-sm font-semibold">Zu prüfen</h2>
          <p className="mt-1 text-xs text-gray-500">
            Vorschläge werden erst nach deiner Bestätigung als Zahlung gebucht.
          </p>
        </div>
        {unresolved.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-gray-500">Keine ungeklärten Zahlungseingänge.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {unresolved.map((transaction) => {
              const selectedInvoiceId = selections[transaction.id] ?? transaction.suggestions[0]?.invoiceId ?? "";
              const suggestion = transaction.suggestions.find((item) => item.invoiceId === selectedInvoiceId);
              return (
                <div key={transaction.id} className="grid gap-4 p-5 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,0.9fr)]">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <span className="text-lg font-semibold tabular-nums">{eur.format(transaction.amount)}</span>
                      <span className="text-xs text-gray-500">gebucht am {formatDate(transaction.bookingDate)}</span>
                    </div>
                    <p className="mt-2 font-medium">{transaction.counterpartyName ?? "Auftraggeber nicht erkannt"}</p>
                    {transaction.paymentReference && <p className="mt-1 break-words text-sm text-gray-700">{transaction.paymentReference}</p>}
                    {transaction.counterpartyIban && <p className="mt-1 text-xs text-gray-400">IBAN {transaction.counterpartyIban}</p>}
                    <details className="mt-2 text-xs text-gray-500">
                      <summary className="cursor-pointer hover:text-gray-700">Vollständigen Buchungstext anzeigen</summary>
                      <p className="mt-2 break-words rounded-lg bg-gray-50 p-3">{transaction.description}</p>
                    </details>
                  </div>
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">
                        {transaction.suggestions.length > 0 ? "Vorschlag prüfen" : "Keine sichere Empfehlung"}
                      </p>
                      {suggestion && <span className="text-xs font-medium text-amber-700">Trefferwert {suggestion.score}/100</span>}
                    </div>
                    <select
                      value={selectedInvoiceId}
                      onChange={(event) => setSelections((current) => ({ ...current, [transaction.id]: event.target.value }))}
                      className="mt-3 w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm"
                    >
                      <option value="">Rechnung auswählen …</option>
                      {initialData.invoices.map((invoice) => (
                        <option key={invoice.id} value={invoice.id}>
                          {invoice.number} · {invoice.customerName} · offen {eur.format(invoice.openAmount)}
                        </option>
                      ))}
                    </select>
                    {suggestion && (
                      <ul className="mt-2 list-disc pl-5 text-xs text-amber-900">
                        {suggestion.reasons.map((reason) => <li key={reason}>{reason}</li>)}
                      </ul>
                    )}
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        onClick={() => act(transaction.id, "MATCH", suggestion?.grantSkonto ?? false)}
                        disabled={busyId === transaction.id || !selectedInvoiceId}
                        className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                      >
                        {busyId === transaction.id ? "Bitte warten …" : suggestion ? "Vorschlag übernehmen" : "Zuordnen"}
                      </button>
                      <button
                        onClick={() => act(transaction.id, "IGNORE")}
                        disabled={busyId === transaction.id}
                        className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                      >
                        Nicht zuordnen
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {completed.length > 0 && (
        <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-5 py-4">
            <h2 className="text-sm font-semibold">Zuletzt bearbeitet</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                  <th className="px-5 py-3">Datum</th><th className="px-2 py-3">Auftraggeber</th>
                  <th className="px-2 py-3">Ergebnis</th><th className="px-2 py-3 text-right">Betrag</th><th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {completed.map((transaction) => (
                  <tr key={transaction.id} className="border-b border-gray-100 last:border-0">
                    <td className="px-5 py-3 text-gray-500">{formatDate(transaction.bookingDate)}</td>
                    <td className="px-2 py-3">{transaction.counterpartyName ?? "—"}</td>
                    <td className="px-2 py-3">
                      {transaction.payment ? (
                        <Link href={`/invoices/${transaction.payment.invoiceId}`} className="text-blue-700 hover:underline">
                          {transaction.payment.invoiceNumber} · {transaction.payment.customerName}
                        </Link>
                      ) : <span className="text-gray-500">Nicht zugeordnet</span>}
                    </td>
                    <td className="px-2 py-3 text-right font-medium tabular-nums">{eur.format(transaction.amount)}</td>
                    <td className="px-5 py-3 text-right">
                      {transaction.ignoredAt && (
                        <button onClick={() => act(transaction.id, "REOPEN")} className="text-xs text-blue-700 hover:underline">
                          Wieder prüfen
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
