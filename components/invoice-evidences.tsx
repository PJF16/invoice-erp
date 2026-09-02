"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const TYPE_LABELS: Record<string, string> = {
  TRANSPORT_PROOF: "Transportnachweis",
  EXPORT_PROOF: "Ausfuhrnachweis",
  TAX_DOCUMENT: "Steuerlicher Nachweis",
  OTHER: "Sonstiger Nachweis",
};

type Evidence = {
  id: string;
  type: string;
  fileName: string;
  size: number;
  note: string | null;
  createdAt: string;
};

export function InvoiceEvidences({ invoiceId, evidences }: { invoiceId: string; evidences: Evidence[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    const form = new FormData(event.currentTarget);
    const response = await fetch(`/api/invoices/${invoiceId}/evidences`, { method: "POST", body: form });
    setLoading(false);
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setError(data?.error ?? "Nachweis konnte nicht gespeichert werden");
      return;
    }
    event.currentTarget.reset();
    router.refresh();
  }

  async function remove(evidence: Evidence) {
    if (!confirm(`Nachweis „${evidence.fileName}“ ausblenden? Die Datei bleibt aus Nachvollziehbarkeitsgründen intern erhalten.`)) return;
    const response = await fetch(`/api/invoices/${invoiceId}/evidences/${evidence.id}`, { method: "DELETE" });
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setError(data?.error ?? "Nachweis konnte nicht entfernt werden");
      return;
    }
    router.refresh();
  }

  return (
    <section className="mt-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-sm font-semibold">Steuerliche Nachweise</h2>
        <p className="mt-1 text-xs text-gray-500">
          Transport-, Ausfuhr- und sonstige Nachweise werden in der Datenbank gespeichert und dadurch mitgesichert.
        </p>
      </div>

      {evidences.length > 0 && (
        <ul className="mb-5 divide-y divide-gray-100 rounded-lg border border-gray-200">
          {evidences.map((evidence) => (
            <li key={evidence.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2 text-sm">
              <div className="min-w-0">
                <a href={`/api/invoices/${invoiceId}/evidences/${evidence.id}`} className="font-medium text-blue-700 hover:underline">
                  {evidence.fileName}
                </a>
                <p className="text-xs text-gray-500">
                  {TYPE_LABELS[evidence.type]} · {(evidence.size / 1024).toFixed(evidence.size < 1024 ? 1 : 0)} KB · {new Intl.DateTimeFormat("de-AT").format(new Date(evidence.createdAt))}
                </p>
                {evidence.note && <p className="mt-1 text-xs text-gray-600">{evidence.note}</p>}
              </div>
              <button type="button" onClick={() => remove(evidence)} className="text-xs text-red-600 hover:underline">
                Entfernen
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={upload} className="grid gap-3 md:grid-cols-4">
        <select name="type" className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
          <option value="TRANSPORT_PROOF">Transportnachweis</option>
          <option value="EXPORT_PROOF">Ausfuhrnachweis</option>
          <option value="TAX_DOCUMENT">Steuerlicher Nachweis</option>
          <option value="OTHER">Sonstiger Nachweis</option>
        </select>
        <input name="file" type="file" required className="rounded-lg border border-gray-300 px-3 py-2 text-sm md:col-span-2" />
        <button disabled={loading} className="rounded-lg bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-black disabled:opacity-50">
          {loading ? "Speichere…" : "Nachweis speichern"}
        </button>
        <input name="note" maxLength={500} placeholder="Optionale Notiz / Referenz" className="rounded-lg border border-gray-300 px-3 py-2 text-sm md:col-span-4" />
      </form>
      <p className="mt-2 text-xs text-gray-500">Maximal 10 MB pro Datei. Entfernte Dateien werden nur ausgeblendet, nicht physisch gelöscht.</p>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </section>
  );
}

