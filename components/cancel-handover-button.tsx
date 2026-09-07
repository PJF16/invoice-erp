"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function CancelHandoverButton({ endpoint, label = "Übergabe stornieren" }: { endpoint: string; label?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setLoading(true);
    setError(null);
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
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

  if (!open) return <button type="button" onClick={() => setOpen(true)} className="rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50">{label}</button>;
  return (
    <div className="w-full min-w-72 rounded-lg border border-red-200 bg-red-50 p-3">
      <label className="block text-xs font-semibold text-red-900">Stornogrund *</label>
      <textarea autoFocus rows={2} value={reason} onChange={(event) => setReason(event.target.value)} className="mt-1 w-full rounded-lg border border-red-200 bg-white px-3 py-2 text-sm" />
      {error && <p className="mt-1 text-xs text-red-700">{error}</p>}
      <div className="mt-2 flex justify-end gap-2">
        <button type="button" disabled={loading} onClick={() => { setOpen(false); setError(null); }} className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs">Abbrechen</button>
        <button type="button" disabled={loading || reason.trim().length < 3} onClick={submit} className="rounded-lg bg-red-700 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40">{loading ? "Storniere…" : "Storno bestätigen"}</button>
      </div>
    </div>
  );
}
