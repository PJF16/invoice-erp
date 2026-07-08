"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type WarehouseData = { id?: string; name: string; location: string | null };

function WarehouseDialog({
  warehouse,
  onClose,
}: {
  warehouse: WarehouseData | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const isEdit = Boolean(warehouse?.id);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const res = await fetch(
      isEdit ? `/api/warehouses/${warehouse!.id}` : "/api/warehouses",
      {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.get("name"),
          location: (form.get("location") as string) || null,
        }),
      },
    );
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
          {isEdit ? "Lager bearbeiten" : "Neues Lager"}
        </h2>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-sm font-medium">Name *</label>
            <input
              name="name"
              required
              defaultValue={warehouse?.name ?? ""}
              autoFocus
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Standort</label>
            <input
              name="location"
              defaultValue={warehouse?.location ?? ""}
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

export function WarehouseForm() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        + Neues Lager
      </button>
      {open && <WarehouseDialog warehouse={null} onClose={() => setOpen(false)} />}
    </>
  );
}

export function WarehouseRowActions({
  warehouse,
}: {
  warehouse: WarehouseData & { id: string };
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);

  async function handleDelete() {
    if (
      !confirm(
        `Lager „${warehouse.name}" wirklich löschen? Bestände und Historie dieses Lagers gehen verloren.`,
      )
    ) {
      return;
    }
    const res = await fetch(`/api/warehouses/${warehouse.id}`, { method: "DELETE" });
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
      {editing && <WarehouseDialog warehouse={warehouse} onClose={() => setEditing(false)} />}
    </div>
  );
}
