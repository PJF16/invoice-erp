"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

type BillingStatus = "PENDING" | "INVOICED" | "GIFTED";
export type CustomerHandoverRow = {
  id: string;
  createdAt: string;
  quantity: number;
  billingStatus: BillingStatus;
  note: string | null;
  customer: { id: string; name: string; customerNumber: string | null };
  item: { name: string; sku: string | null };
  warehouse: { name: string };
  invoice: { id: string; number: string | null; status: string } | null;
};

const options: { value: BillingStatus; label: string }[] = [
  { value: "PENDING", label: "Ausstehend" },
  { value: "INVOICED", label: "Verrechnet" },
  { value: "GIFTED", label: "Verschenkt" },
];
const colors: Record<BillingStatus, string> = {
  PENDING: "border-amber-200 bg-amber-50 text-amber-700",
  INVOICED: "border-blue-200 bg-blue-50 text-blue-700",
  GIFTED: "border-green-200 bg-green-50 text-green-700",
};

export function CustomerHandoversTable({ rows, canCreateInvoice }: { rows: CustomerHandoverRow[]; canCreateInvoice: boolean }) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [updating, setUpdating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const selectedCustomerId = useMemo(
    () => rows.find((row) => selected.includes(row.id))?.customer.id,
    [rows, selected],
  );

  function toggle(row: CustomerHandoverRow) {
    setSelected((current) => {
      if (current.includes(row.id)) return current.filter((id) => id !== row.id);
      if (selectedCustomerId && selectedCustomerId !== row.customer.id) return [row.id];
      return [...current, row.id];
    });
  }

  async function setStatus(id: string, billingStatus: BillingStatus) {
    setUpdating(id);
    setError(null);
    const response = await fetch(`/api/movements/${id}/billing-status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ billingStatus }),
    });
    setUpdating(null);
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setError(data?.error ?? "Status konnte nicht geändert werden");
      return;
    }
    setSelected((current) => current.filter((selectedId) => selectedId !== id));
    router.refresh();
  }

  const dateFormat = new Intl.DateTimeFormat("de-AT", { dateStyle: "medium", timeStyle: "short" });
  return (
    <>
      {canCreateInvoice && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
          <p className="text-sm text-blue-800">
            {selected.length === 0 ? "Offene Positionen eines Kunden auswählen." : `${selected.length} Position${selected.length === 1 ? "" : "en"} ausgewählt`}
          </p>
          <button
            type="button"
            disabled={selected.length === 0}
            onClick={() => router.push(`/invoices/new?bewegungen=${encodeURIComponent(selected.join(","))}`)}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40"
          >
            Rechnung erstellen
          </button>
        </div>
      )}
      {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
            {canCreateInvoice && <th className="w-10 px-3 py-3"><span className="sr-only">Auswahl</span></th>}
            <th className="px-4 py-3">Zeitpunkt</th><th className="px-4 py-3">Kunde</th>
            <th className="px-4 py-3">Artikel</th><th className="px-4 py-3 text-right">Menge</th>
            <th className="px-4 py-3">Lager</th><th className="px-4 py-3">Notiz</th>
            <th className="px-4 py-3">Status</th><th className="px-4 py-3">Rechnung</th>
          </tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={canCreateInvoice ? 9 : 8} className="px-4 py-10 text-center text-gray-500">Keine Kundenübergaben für diesen Filter.</td></tr>}
            {rows.map((row) => {
              const selectable = canCreateInvoice && row.billingStatus === "PENDING";
              const blocked = Boolean(selectedCustomerId && selectedCustomerId !== row.customer.id);
              return <tr key={row.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                {canCreateInvoice && <td className="px-3 py-3 text-center">{selectable && <input type="checkbox" checked={selected.includes(row.id)} disabled={blocked} onChange={() => toggle(row)} aria-label={`${row.item.name} auswählen`} className="h-4 w-4 rounded border-gray-300" />}</td>}
                <td className="whitespace-nowrap px-4 py-3 text-gray-500">{dateFormat.format(new Date(row.createdAt))}</td>
                <td className="px-4 py-3 font-medium">{row.customer.name}{row.customer.customerNumber && <span className="ml-1 text-xs font-normal text-gray-400">({row.customer.customerNumber})</span>}</td>
                <td className="px-4 py-3">{row.item.name}{row.item.sku && <span className="ml-1 text-xs text-gray-400">{row.item.sku}</span>}</td>
                <td className="px-4 py-3 text-right font-semibold tabular-nums">{Math.abs(row.quantity)}</td>
                <td className="px-4 py-3 text-gray-500">{row.warehouse.name}</td>
                <td className="max-w-48 truncate px-4 py-3 text-xs text-gray-500">{row.note ?? "–"}</td>
                <td className="px-4 py-3">{row.invoice ? <span className={`inline-block rounded-full border px-2 py-1 text-xs font-medium ${colors.INVOICED}`}>Verrechnet</span> : <select value={row.billingStatus} disabled={updating === row.id} onChange={(event) => setStatus(row.id, event.target.value as BillingStatus)} className={`rounded-lg border px-2 py-1 text-xs font-medium ${colors[row.billingStatus]}`}>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>}</td>
                <td className="px-4 py-3">{row.invoice ? <Link href={`/invoices/${row.invoice.id}`} className="text-blue-600 hover:underline">{row.invoice.number ?? "Entwurf"}</Link> : <span className="text-gray-400">–</span>}</td>
              </tr>;
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
