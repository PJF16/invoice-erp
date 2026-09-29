"use client";

import { useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import { safeFetch as fetch } from "@/lib/client-fetch";
import { Modal } from "@/components/modal";
import { CustomerSelect } from "@/components/customer-select";

type Props = {
  itemId: string; itemName: string;
  warehouses: { id: string; name: string }[];
  stocks: { warehouseId: string; quantity: number }[];
  customers: { id: string; name: string; customerNumber: string | null }[];
  defaultWarehouseId?: string;
};
export function StockActions({ itemId, itemName, warehouses, stocks, customers, defaultWarehouseId }: Props) {
  const router = useRouter();
  const id = useId();
  const [mode, setMode] = useState<"IN" | "OUT" | null>(null);
  const [warehouseId, setWarehouseId] = useState(defaultWarehouseId ?? warehouses[0]?.id ?? "");
  const [customerId, setCustomerId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [suppliers, setSuppliers] = useState<string[]>([]);
  const available = stocks.find((stock) => stock.warehouseId === warehouseId)?.quantity ?? 0;
  useEffect(() => {
    if (mode === "IN") fetch("/api/suppliers").then((r) => r.ok ? r.json() : []).then(setSuppliers).catch(() => {});
  }, [mode]);
  function open(next: "IN" | "OUT") {
    setError(null); setCustomerId(""); setWarehouseId(defaultWarehouseId ?? warehouses[0]?.id ?? ""); setMode(next);
  }
  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(null); setLoading(true);
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/movements", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        itemId, warehouseId, type: mode, quantity: Number(form.get("quantity")),
        customerId: mode === "OUT" ? customerId || null : null,
        supplier: mode === "IN" ? form.get("supplier") || null : null, note: form.get("note") || null,
      }) });
      if (response.ok) { setMode(null); router.refresh(); }
      else { const data = await response.json(); setError(data.error ?? "Buchung fehlgeschlagen"); }
    } catch { setError("Buchung fehlgeschlagen. Bitte den aktuellen Bestand prüfen."); }
    finally { setLoading(false); }
  }
  const input = "mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm";
  return <>
    <div className="inline-flex gap-1"><button onClick={() => open("IN")} className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs font-semibold text-green-700">+ Ein</button><button onClick={() => open("OUT")} className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">– Aus</button></div>
    {mode && <Modal title={`${mode === "IN" ? "Einbuchen" : "Ausbuchen"}: ${itemName}`} onClose={() => setMode(null)} busy={loading}>
      <form onSubmit={handleSubmit} className="space-y-4 text-left">
        <label className="block text-sm font-medium">Lager<select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} required className={input}>{warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select></label>
        <p id={`${id}-stock`} className="rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-900" role="status">Verfügbar im gewählten Lager: <strong>{available} Stück</strong></p>
        <label className="block text-sm font-medium">Menge<input name="quantity" type="number" min={1} max={mode === "OUT" ? available : undefined} step={1} defaultValue={1} required autoFocus aria-describedby={`${id}-stock`} className={input} /></label>
        {mode === "IN" && <label className="block text-sm font-medium">Lieferant (optional)<input name="supplier" list={`${id}-suppliers`} className={input} /><datalist id={`${id}-suppliers`}>{suppliers.map((s) => <option key={s} value={s} />)}</datalist></label>}
        {mode === "OUT" && <div><p className="mb-1 text-sm font-medium">Kunde (optional)</p><CustomerSelect customers={customers} value={customerId} onValueChange={setCustomerId} /><p className="mt-1 text-xs text-gray-500">Mit Kunde erscheint der Ausgang als ausstehende Übergabe.</p></div>}
        <label className="block text-sm font-medium">Notiz (optional)<input name="note" className={input} /></label>
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2"><button type="button" disabled={loading} onClick={() => setMode(null)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm">Abbrechen</button><button disabled={loading || !warehouseId || (mode === "OUT" && available === 0)} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{loading ? "Buche…" : mode === "IN" ? "Einbuchen" : "Ausbuchen"}</button></div>
      </form>
    </Modal>}
  </>;
}
