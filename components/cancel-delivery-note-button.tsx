"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

type CancelableLine = {
  id: string;
  position: number;
  itemName: string;
  itemSku: string | null;
  remainingQuantity: number;
};

export function CancelDeliveryNoteButton({ endpoint, lines }: { endpoint: string; lines: CancelableLine[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>(
    Object.fromEntries(lines.map((line) => [line.id, line.remainingQuantity])),
  );
  const [selected, setSelected] = useState<Record<string, boolean>>(
    Object.fromEntries(lines.map((line) => [line.id, true])),
  );
  const chosenLines = useMemo(() => lines.filter((line) => selected[line.id]), [lines, selected]);

  async function submit() {
    setLoading(true);
    setError(null);
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reason,
        lines: chosenLines.map((line) => ({ lineId: line.id, quantity: quantities[line.id] })),
      }),
    });
    setLoading(false);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error ?? "Stornierung fehlgeschlagen");
      return;
    }
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return <button type="button" onClick={() => setOpen(true)} className="rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50">Positionen stornieren</button>;
  }

  return (
    <div className="w-full min-w-80 rounded-lg border border-red-200 bg-red-50 p-4">
      <p className="text-sm font-semibold text-red-900">Zu stornierende Positionen</p>
      <div className="mt-2 max-h-64 space-y-2 overflow-y-auto">
        {lines.map((line) => (
          <div key={line.id} className="flex items-center gap-3 rounded-lg border border-red-100 bg-white p-2">
            <input
              type="checkbox"
              checked={selected[line.id] ?? false}
              onChange={(event) => setSelected((current) => ({ ...current, [line.id]: event.target.checked }))}
              aria-label={`Position ${line.position} auswählen`}
              className="h-4 w-4 rounded border-gray-300"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{line.position}. {line.itemName}</p>
              <p className="text-xs text-gray-500">{line.itemSku ?? "Ohne SKU"} · noch {line.remainingQuantity} Stk</p>
            </div>
            <input
              type="number"
              min={1}
              max={line.remainingQuantity}
              value={quantities[line.id]}
              disabled={!selected[line.id]}
              onChange={(event) => setQuantities((current) => ({ ...current, [line.id]: Number(event.target.value) }))}
              aria-label={`Stornomenge für Position ${line.position}`}
              className="w-20 rounded-lg border border-gray-300 px-2 py-1 text-right text-sm disabled:bg-gray-100"
            />
          </div>
        ))}
      </div>
      <label className="mt-3 block text-xs font-semibold text-red-900">Stornogrund *</label>
      <textarea autoFocus rows={2} value={reason} onChange={(event) => setReason(event.target.value)} className="mt-1 w-full rounded-lg border border-red-200 bg-white px-3 py-2 text-sm" />
      {error && <p className="mt-1 text-xs text-red-700">{error}</p>}
      <div className="mt-3 flex justify-end gap-2">
        <button type="button" disabled={loading} onClick={() => { setOpen(false); setError(null); }} className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs">Abbrechen</button>
        <button
          type="button"
          disabled={loading || reason.trim().length < 3 || chosenLines.length === 0 || chosenLines.some((line) => !Number.isInteger(quantities[line.id]) || quantities[line.id] < 1 || quantities[line.id] > line.remainingQuantity)}
          onClick={submit}
          className="rounded-lg bg-red-700 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
        >{loading ? "Storniere…" : "Auswahl stornieren"}</button>
      </div>
    </div>
  );
}
