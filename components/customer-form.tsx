"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TAX_TREATMENT_OPTIONS } from "@/lib/format";

type CustomerData = {
  id?: string;
  customerNumber: string | null;
  name: string;
  contactPerson: string | null;
  email: string | null;
  street: string;
  zip: string;
  city: string;
  country: string;
  uid: string | null;
  defaultTaxTreatment: string;
  notes: string | null;
};

function CustomerDialog({ customer, onClose }: { customer: CustomerData | null; onClose: () => void }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const isEdit = Boolean(customer?.id);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const res = await fetch(isEdit ? `/api/customers/${customer!.id}` : "/api/customers", {
      method: isEdit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerNumber: (form.get("customerNumber") as string) || null,
        name: form.get("name"),
        contactPerson: (form.get("contactPerson") as string) || null,
        email: (form.get("email") as string) || null,
        street: form.get("street"),
        zip: form.get("zip"),
        city: form.get("city"),
        country: form.get("country"),
        uid: (form.get("uid") as string) || null,
        defaultTaxTreatment: form.get("defaultTaxTreatment"),
        notes: (form.get("notes") as string) || null,
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
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 text-left shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold">{isEdit ? "Kunde bearbeiten" : "Neuer Kunde"}</h2>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium">Firmenname *</label>
              <input name="name" required defaultValue={customer?.name ?? ""} autoFocus className={input} />
            </div>
            <div>
              <label className="block text-sm font-medium">Kundennummer</label>
              <input
                name="customerNumber"
                defaultValue={customer?.customerNumber ?? ""}
                placeholder="z.B. K-1001"
                className={`${input} font-mono`}
              />
            </div>
            <div>
              <label className="block text-sm font-medium">Ansprechperson</label>
              <input name="contactPerson" defaultValue={customer?.contactPerson ?? ""} className={input} />
            </div>
            <div>
              <label className="block text-sm font-medium">E-Mail (für Rechnungsversand)</label>
              <input name="email" type="email" defaultValue={customer?.email ?? ""} className={input} />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium">Straße</label>
              <input name="street" defaultValue={customer?.street ?? ""} className={input} />
            </div>
            <div>
              <label className="block text-sm font-medium">PLZ</label>
              <input name="zip" defaultValue={customer?.zip ?? ""} className={input} />
            </div>
            <div>
              <label className="block text-sm font-medium">Ort</label>
              <input name="city" defaultValue={customer?.city ?? ""} className={input} />
            </div>
            <div>
              <label className="block text-sm font-medium">Land</label>
              <input name="country" defaultValue={customer?.country ?? "Österreich"} className={input} />
            </div>
            <div>
              <label className="block text-sm font-medium">UID-Nummer</label>
              <input
                name="uid"
                defaultValue={customer?.uid ?? ""}
                placeholder="z.B. DE123456789"
                className={`${input} font-mono`}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium">Standard-Steuerbehandlung</label>
              <select
                name="defaultTaxTreatment"
                defaultValue={customer?.defaultTaxTreatment ?? "STANDARD"}
                className={input}
              >
                {TAX_TREATMENT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-500">
                Wird bei neuen Rechnungen vorausgewählt, z.B. Reverse Charge für deutsche Firmenkunden mit UID.
              </p>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium">Notizen</label>
              <textarea name="notes" rows={2} defaultValue={customer?.notes ?? ""} className={input} />
            </div>
          </div>
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

export function CustomerForm() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        + Neuer Kunde
      </button>
      {open && <CustomerDialog customer={null} onClose={() => setOpen(false)} />}
    </>
  );
}

export function CustomerRowActions({ customer }: { customer: CustomerData & { id: string } }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);

  async function handleDelete() {
    if (!confirm(`Kunde „${customer.name}" wirklich löschen?`)) return;
    const res = await fetch(`/api/customers/${customer.id}`, { method: "DELETE" });
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
      {editing && <CustomerDialog customer={customer} onClose={() => setEditing(false)} />}
    </div>
  );
}
