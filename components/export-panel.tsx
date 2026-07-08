"use client";

import { useState } from "react";

type Customer = { id: string; name: string };

export function ExportPanel({ customers }: { customers: Customer[] }) {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [includeInvoices, setIncludeInvoices] = useState(true);
  const [includeCreditNotes, setIncludeCreditNotes] = useState(false);
  const [status, setStatus] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const types = [includeInvoices && "INVOICE", includeCreditNotes && "CREDIT_NOTE"].filter(Boolean);
    if (types.length === 0) {
      setError("Mindestens ein Dokumenttyp ist erforderlich");
      return;
    }
    setLoading(true);
    const res = await fetch("/api/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dateFrom: dateFrom || null,
        dateTo: dateTo || null,
        types,
        status: status || null,
        customerId: customerId || null,
      }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Export fehlgeschlagen");
      return;
    }
    const blob = await res.blob();
    const filename =
      res.headers.get("Content-Disposition")?.match(/filename="(.+)"/)?.[1] ?? "Belege.zip";
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  const input = "mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm";
  const label = "block text-sm font-medium";

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div>
        <label className={label}>Von</label>
        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={input} />
      </div>
      <div>
        <label className={label}>Bis</label>
        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={input} />
      </div>
      <div>
        <label className={label}>Status</label>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={input}>
          <option value="">Alle Status</option>
          <option value="OPEN">Offen</option>
          <option value="SENT">Versendet</option>
          <option value="PAID">Bezahlt</option>
          <option value="CANCELED">Storniert</option>
        </select>
      </div>
      <div>
        <label className={label}>Kunde</label>
        <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className={input}>
          <option value="">Alle Kunden</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="sm:col-span-2 lg:col-span-2">
        <label className={label}>Dokumenttyp</label>
        <div className="mt-1 flex gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={includeInvoices} onChange={(e) => setIncludeInvoices(e.target.checked)} />
            Rechnungen
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={includeCreditNotes}
              onChange={(e) => setIncludeCreditNotes(e.target.checked)}
            />
            Gutschriften
          </label>
        </div>
      </div>

      <div className="flex items-end justify-end gap-2 sm:col-span-2 lg:col-span-2">
        {error && <p className="mr-auto self-center text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Erstelle ZIP…" : "Als ZIP herunterladen"}
        </button>
      </div>
    </form>
  );
}
