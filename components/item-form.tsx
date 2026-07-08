"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type ItemData = {
  id?: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  description: string | null;
};

function ItemDialog({
  item,
  onClose,
}: {
  item: ItemData | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const isEdit = Boolean(item?.id);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const body = JSON.stringify({
      name: form.get("name"),
      sku: (form.get("sku") as string) || null,
      barcode: (form.get("barcode") as string) || null,
      description: (form.get("description") as string) || null,
    });
    const res = await fetch(isEdit ? `/api/items/${item!.id}` : "/api/items", {
      method: isEdit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    setLoading(false);
    if (res.ok) {
      onClose();
      router.refresh();
    } else {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Speichern fehlgeschlagen");
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-xl bg-white p-6 text-left shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold">
          {isEdit ? "Artikel bearbeiten" : "Neuer Artikel"}
        </h2>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-sm font-medium">Bezeichnung *</label>
            <input
              name="name"
              required
              defaultValue={item?.name ?? ""}
              autoFocus
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium">SKU / Artikelnummer</label>
            <input
              name="sku"
              defaultValue={item?.sku ?? ""}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Barcode</label>
            <input
              name="barcode"
              defaultValue={item?.barcode ?? ""}
              placeholder="EAN / UPC für Scanner"
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono"
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Beschreibung</label>
            <textarea
              name="description"
              rows={2}
              defaultValue={item?.description ?? ""}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? "Speichere…" : "Speichern"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function ItemForm() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        + Neuer Artikel
      </button>
      {open && <ItemDialog item={null} onClose={() => setOpen(false)} />}
    </>
  );
}

export function ItemRowActions({ item }: { item: ItemData & { id: string } }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);

  async function handleDelete() {
    if (!confirm(`Artikel „${item.name}" wirklich löschen? Bestand und Historie gehen verloren.`)) {
      return;
    }
    const res = await fetch(`/api/items/${item.id}`, { method: "DELETE" });
    if (res.ok) router.refresh();
    else alert("Löschen fehlgeschlagen");
  }

  return (
    <div className="inline-flex gap-1">
      <button
        onClick={() => setEditing(true)}
        className="rounded-lg border border-gray-300 px-2.5 py-1 text-xs hover:bg-gray-100"
      >
        Bearbeiten
      </button>
      <button
        onClick={handleDelete}
        className="rounded-lg border border-red-200 px-2.5 py-1 text-xs text-red-600 hover:bg-red-50"
      >
        Löschen
      </button>
      {editing && <ItemDialog item={item} onClose={() => setEditing(false)} />}
    </div>
  );
}
