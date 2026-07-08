"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  itemId: string;
  itemName: string;
  warehouses: { id: string; name: string }[];
  defaultWarehouseId?: string;
};

export function StockActions({ itemId, itemName, warehouses, defaultWarehouseId }: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<"IN" | "OUT" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/movements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        itemId,
        warehouseId: form.get("warehouseId"),
        type: mode,
        quantity: Number(form.get("quantity")),
        note: (form.get("note") as string) || null,
      }),
    });
    setLoading(false);
    if (res.ok) {
      setMode(null);
      router.refresh();
    } else {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Buchung fehlgeschlagen");
    }
  }

  return (
    <>
      <div className="inline-flex gap-1">
        <button
          onClick={() => setMode("IN")}
          className="rounded-lg border border-green-200 bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-700 hover:bg-green-100"
          title="Einbuchen"
        >
          + Ein
        </button>
        <button
          onClick={() => setMode("OUT")}
          className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-100"
          title="Ausbuchen"
        >
          – Aus
        </button>
      </div>

      {mode && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setMode(null)}
        >
          <div
            className="w-full max-w-sm rounded-xl bg-white p-6 text-left shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold">
              {mode === "IN" ? "Einbuchen" : "Ausbuchen"}: {itemName}
            </h2>
            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium">Lager</label>
                <select
                  name="warehouseId"
                  defaultValue={defaultWarehouseId ?? warehouses[0]?.id}
                  required
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                >
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium">Menge</label>
                <input
                  name="quantity"
                  type="number"
                  min={1}
                  step={1}
                  defaultValue={1}
                  required
                  autoFocus
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Notiz (optional)</label>
                <input
                  name="note"
                  type="text"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setMode(null)}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className={`rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50 ${
                    mode === "IN" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"
                  }`}
                >
                  {loading ? "Buche…" : mode === "IN" ? "Einbuchen" : "Ausbuchen"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
