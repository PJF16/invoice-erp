"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CustomerSelect, type CustomerSelectOption } from "@/components/customer-select";

type ItemOption = {
  id: string;
  name: string;
  sku: string | null;
  stocks: { warehouseId: string; quantity: number }[];
};

type Line = { key: number; itemId: string; warehouseId: string; quantity: number };
let keyCounter = 1;
const newLine = (): Line => ({ key: keyCounter++, itemId: "", warehouseId: "", quantity: 1 });

export function DeliveryNoteForm({
  customers,
  items,
  warehouses,
  defaultIssueDate,
}: {
  customers: CustomerSelectOption[];
  items: ItemOption[];
  warehouses: { id: string; name: string }[];
  defaultIssueDate: string;
}) {
  const router = useRouter();
  const [customerId, setCustomerId] = useState("");
  const [issueDate, setIssueDate] = useState(defaultIssueDate);
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([newLine()]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateLine(key: number, patch: Partial<Line>) {
    setLines((current) => current.map((line) => line.key === key ? { ...line, ...patch } : line));
  }

  function selectItem(line: Line, itemId: string) {
    const item = items.find((entry) => entry.id === itemId);
    const preferredWarehouse = item?.stocks.find((stock) => stock.quantity > 0)?.warehouseId ?? "";
    updateLine(line.key, { itemId, warehouseId: preferredWarehouse });
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const keys = lines.map((line) => `${line.itemId}:${line.warehouseId}`);
    if (new Set(keys).size !== keys.length) {
      setError("Derselbe Artikel und dasselbe Lager dürfen nur einmal vorkommen");
      return;
    }
    setLoading(true);
    const response = await fetch("/api/delivery-notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerId,
        issueDate,
        notes: notes || null,
        lines: lines.map(({ itemId, warehouseId, quantity }) => ({ itemId, warehouseId, quantity })),
      }),
    });
    setLoading(false);
    if (response.ok) {
      const deliveryNote = await response.json();
      router.push(`/delivery-notes/${deliveryNote.id}`);
      router.refresh();
      return;
    }
    const body = await response.json().catch(() => null);
    setError(body?.error ?? "Lieferschein konnte nicht erstellt werden");
  }

  const input = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm";
  const label = "block text-sm font-medium";
  return (
    <form onSubmit={submit} className="space-y-6">
      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <label className={label}>Kunde *</label>
            <CustomerSelect customers={customers} value={customerId} onValueChange={setCustomerId} required className="mt-1" />
          </div>
          <div>
            <label className={label}>Lieferdatum *</label>
            <input type="date" required value={issueDate} onChange={(event) => setIssueDate(event.target.value)} className={`${input} mt-1`} />
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-4">
          <h2 className="text-sm font-semibold">Gelieferte Artikel</h2>
          <p className="text-xs text-gray-500">Beim Erstellen werden alle Positionen gemeinsam ausgebucht und als offene Kundenübergaben vorgemerkt.</p>
        </div>
        <div className="space-y-3">
          {lines.map((line, index) => {
            const item = items.find((entry) => entry.id === line.itemId);
            const stock = item?.stocks.find((entry) => entry.warehouseId === line.warehouseId)?.quantity ?? 0;
            return (
              <div key={line.key} className="grid gap-3 rounded-lg border border-gray-200 p-4 sm:grid-cols-12">
                <div className="sm:col-span-5">
                  <label className={label}>Artikel {index + 1} *</label>
                  <select required value={line.itemId} onChange={(event) => selectItem(line, event.target.value)} className={`${input} mt-1`}>
                    <option value="">– Artikel wählen –</option>
                    {items.map((entry) => <option key={entry.id} value={entry.id}>{entry.sku ? `${entry.sku} · ` : ""}{entry.name}</option>)}
                  </select>
                </div>
                <div className="sm:col-span-4">
                  <label className={label}>Lager *</label>
                  <select required value={line.warehouseId} onChange={(event) => updateLine(line.key, { warehouseId: event.target.value })} className={`${input} mt-1`}>
                    <option value="">– Lager wählen –</option>
                    {warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}
                  </select>
                  {line.itemId && line.warehouseId && <p className={`mt-1 text-xs ${stock < line.quantity ? "text-red-600" : "text-gray-500"}`}>Bestand: {stock}</p>}
                </div>
                <div className="sm:col-span-2">
                  <label className={label}>Menge *</label>
                  <input type="number" min={1} step={1} required value={line.quantity} onChange={(event) => updateLine(line.key, { quantity: Number(event.target.value) })} className={`${input} mt-1`} />
                </div>
                <div className="flex items-end sm:col-span-1">
                  {lines.length > 1 && <button type="button" onClick={() => setLines((current) => current.filter((entry) => entry.key !== line.key))} className="w-full rounded-lg border border-red-200 px-2 py-2 text-sm text-red-600 hover:bg-red-50" aria-label={`Position ${index + 1} entfernen`}>×</button>}
                </div>
              </div>
            );
          })}
        </div>
        <button type="button" onClick={() => setLines((current) => [...current, newLine()])} className="mt-4 rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50">+ Position hinzufügen</button>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <label className={label}>Notiz (optional)</label>
        <textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} className={`${input} mt-1`} />
      </section>
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => router.back()} className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50">Abbrechen</button>
        <button type="submit" disabled={loading} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">{loading ? "Buche aus…" : "Lieferschein erstellen & ausbuchen"}</button>
      </div>
    </form>
  );
}
