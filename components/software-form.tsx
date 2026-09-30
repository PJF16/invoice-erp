"use client";

import { safeFetch as fetch } from "@/lib/client-fetch";

import { useState } from "react";
import { useRouter } from "next/navigation";

type SoftwareData = {
  id?: string;
  name: string;
  description: string | null;
  unitPrice: number;
  unit: string;
  active: boolean;
  supplyKind: string;
  catalogType: "SOFTWARE" | "SERVICE";
};

function SoftwareDialog({ item, catalogType, onClose }: { item: SoftwareData | null; catalogType: SoftwareData["catalogType"]; onClose: () => void }) {
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
        supplyKind: form.get("supplyKind"),
        catalogType: form.get("catalogType"),
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
        <h2 className="text-lg font-semibold">{isEdit ? "Eintrag bearbeiten" : "Neuen Eintrag anlegen"}</h2>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-sm font-medium">Typ</label>
            <select name="catalogType" defaultValue={item?.catalogType ?? catalogType} className={input}>
              <option value="SOFTWARE">Softwareartikel</option>
              <option value="SERVICE">Dienstleistung</option>
            </select>
          </div>
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
              <input name="unit" defaultValue={item?.unit ?? (catalogType === "SERVICE" ? "Std" : "Monat")} className={input} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium">Leistungsart</label>
            <select
              name="supplyKind"
              defaultValue={item?.supplyKind ?? (catalogType === "SERVICE" ? "SERVICE" : "ELECTRONIC_SERVICE")}
              className={input}
            >
              <option value="ELECTRONIC_SERVICE">Elektronisch erbrachte Dienstleistung</option>
              <option value="SERVICE">Sonstige Dienstleistung</option>
            </select>
            <p className="mt-1 text-xs text-gray-500">
              Die Leistungsart bestimmt die steuerliche Behandlung bei grenzüberschreitenden Rechnungen.
            </p>
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
  const [open, setOpen] = useState<SoftwareData["catalogType"] | null>(null);
  return (
    <>
      <button
        onClick={() => setOpen("SOFTWARE")}
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        + Neuer Softwareartikel
      </button>
      <button onClick={() => setOpen("SERVICE")} className="rounded-lg border border-blue-600 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50">
        + Neue Dienstleistung
      </button>
      {open && <SoftwareDialog item={null} catalogType={open} onClose={() => setOpen(null)} />}
    </>
  );
}

export function SoftwareRowActions({ item }: { item: SoftwareData & { id: string } }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);

  async function handleDelete() {
    if (!confirm(`Eintrag „${item.name}“ wirklich löschen?`)) return;
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
      {editing && <SoftwareDialog item={item} catalogType={item.catalogType} onClose={() => setEditing(false)} />}
    </div>
  );
}
