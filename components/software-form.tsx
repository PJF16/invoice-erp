"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type SoftwareData = {
  id?: string;
  name: string;
  description: string | null;
  unitPrice: number;
  unit: string;
  active: boolean;
};

function SoftwareDialog({ item, onClose }: { item: SoftwareData | null; onClose: () => void }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const isEdit = Boolean(item?.id);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const res = await fetch(isEdit ? `/api/software-items/${item!.id}` : "/api/software-items", {
      method: isEdit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        description: (form.get("description") as string) || null,
        unitPrice: Number(form.get("unitPrice")),
        unit: form.get("unit"),
        active: form.get("active") === "on",
      }),
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

  const input = "mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-xl bg-white p-6 text-left shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold">{isEdit ? "Softwareartikel bearbeiten" : "Neuer Softwareartikel"}</h2>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-sm font-medium">Name *</label>
            <input name="name" required defaultValue={item?.name ?? ""} autoFocus className={input} />
          </div>
          <div>
            <label className="block text-sm font-medium">Beschreibung</label>
            <textarea name="description" rows={2} defaultValue={item?.description ?? ""} className={input} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium">Preis netto (€) *</label>
              <input
                name="unitPrice"
                type="number"
                min={0}
                step="0.01"
                required
                defaultValue={item?.unitPrice ?? ""}
                className={input}
              />
            </div>
            <div>
              <label className="block text-sm font-medium">Einheit</label>
              <input name="unit" defaultValue={item?.unit ?? "Monat"} className={input} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="active" defaultChecked={item?.active ?? true} />
            Aktiv (in Auswahllisten sichtbar)
          </label>
          {isEdit && (
            <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-800">
              Preisänderungen gelten für alle künftig erzeugten wiederkehrenden Rechnungen. Bereits
              erstellte Rechnungen bleiben unverändert.
            </p>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50">
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

export function SoftwareForm() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        + Neuer Softwareartikel
      </button>
      {open && <SoftwareDialog item={null} onClose={() => setOpen(false)} />}
    </>
  );
}

export function SoftwareRowActions({ item }: { item: SoftwareData & { id: string } }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);

  async function handleDelete() {
    if (!confirm(`Softwareartikel „${item.name}" wirklich löschen?`)) return;
    const res = await fetch(`/api/software-items/${item.id}`, { method: "DELETE" });
    if (res.ok) router.refresh();
    else {
      const data = await res.json().catch(() => null);
      alert(data?.error ?? "Löschen fehlgeschlagen");
    }
  }

  return (
    <div className="inline-flex gap-1">
      <button onClick={() => setEditing(true)} className="rounded-lg border border-gray-300 px-2.5 py-1 text-xs hover:bg-gray-100">
        Bearbeiten
      </button>
      <button onClick={handleDelete} className="rounded-lg border border-red-200 px-2.5 py-1 text-xs text-red-600 hover:bg-red-50">
        Löschen
      </button>
      {editing && <SoftwareDialog item={item} onClose={() => setEditing(false)} />}
    </div>
  );
}
